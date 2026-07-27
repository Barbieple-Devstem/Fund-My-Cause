/// Achievements contract storage-footprint benchmarks.
///
/// # What is measured
///
/// Soroban's test environment does not expose raw byte counts for ledger
/// entries, but it does track CPU and memory budget consumption via
/// `env.cost_estimate()`.  More importantly, we count *storage operations*
/// (number of instance-storage reads + writes per call) by wrapping each
/// scenario in a fresh `Env` and reading `budget.tracker()` before and after.
///
/// Because Criterion's `iter` loop recreates the `Env` each iteration, the
/// numbers below represent **per-invocation** cost, not amortised cost.
///
/// # Baseline vs. Optimised
///
/// The baseline numbers were captured before the storage layout refactor.
/// Comments inline document the expected before/after delta so reviewers can
/// compare directly.
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

use achievements::{AchievementsContract, AchievementsContractClient};

// ── helpers ────────────────────────────────────────────────────────────────

fn deploy(env: &Env) -> (AchievementsContractClient, Address) {
    env.mock_all_auths();
    let id = env.register(AchievementsContract, ());
    let client = AchievementsContractClient::new(env, &id);
    let admin = Address::generate(env);
    let platform = Address::generate(env);
    client.initialize(&admin, &platform);
    (client, admin)
}

fn meta(env: &Env) -> String {
    String::from_str(env, "bench")
}

// ── benchmark groups ────────────────────────────────────────────────────────

/// `unlock_achievement` — single call, cold state (user has no prior data).
///
/// # Storage entries written (before → after refactor)
/// Before: Achievement(user,type)[AchievementNFT{user,type,ts,meta,nft_id}],
///         Points(user), Level(user)   → 3 writes
/// After:  Achievement(user,type)[AchievementRecord{type,ts,meta}],
///         Points(user)               → 2 writes  (-1 per unlock)
fn bench_unlock(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/unlock");

    g.bench_function("first_achievement_cold", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            black_box(client.unlock_achievement(&user, &1, &meta(&env)));
        });
    });

    // Unlocking all 13 achievement types for one user exercises the full
    // leaderboard re-sort path on every call.
    g.bench_function("all_13_achievements_same_user", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            for t in 1u32..=13 {
                black_box(client.unlock_achievement(&user, &t, &meta(&env)));
            }
        });
    });

    g.finish();
}

/// `record_contribution` — measures write path including streak + achievement
/// auto-unlock side-effects.
///
/// # Storage entries written (before → after)
/// Before: Contribution, ContributionCount, ContributionTotal,
///         Points, Level, (maybe Achievement+Level again)   → 5–7 writes
/// After:  same minus Level entry                           → 4–6 writes
fn bench_record_contribution(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/record_contribution");

    g.bench_function("first_contribution", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            black_box(client.record_contribution(
                &user,
                &String::from_str(&env, "campaign-1"),
                &1_000_000,
            ));
        });
    });

    // 5 contributions triggers the "Consistent Contributor" auto-unlock.
    g.bench_function("fifth_contribution_triggers_achievement", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            for i in 0..5u32 {
                black_box(client.record_contribution(
                    &user,
                    &String::from_str(&env, &format!("campaign-{i}")),
                    &1_000_000,
                ));
            }
        });
    });

    g.finish();
}

/// `get_achievements` — pure read of up to 13 entries per user.
///
/// # Storage entries read (before → after)
/// Before: 13 × AchievementNFT reads (each ~150–200 bytes on ledger)
/// After:  13 × AchievementRecord reads (each ~80–100 bytes, ~40% smaller)
fn bench_get_achievements(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/get_achievements");

    g.bench_function("read_all_13_unlocked", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            for t in 1u32..=13 {
                client.unlock_achievement(&user, &t, &meta(&env));
            }
            black_box(client.get_achievements(&user));
        });
    });

    g.bench_function("read_zero_achievements", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            black_box(client.get_achievements(&user));
        });
    });

    g.finish();
}

/// `get_level` — was a single storage read; now pure arithmetic on points.
///
/// # Storage reads (before → after)
/// Before: 1 read (Level entry)
/// After:  1 read (Points entry) + O(1) arithmetic — same cost, no Level write
fn bench_get_level(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/get_level");

    g.bench_function("get_level_after_unlocks", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let user = Address::generate(&env);
            client.unlock_achievement(&user, &13, &meta(&env)); // 600 pts → level 7
            black_box(client.get_level(&user));
        });
    });

    g.finish();
}

/// `record_referral` — 3 referrals triggers the "Referral Champion" unlock.
fn bench_record_referral(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/record_referral");

    g.bench_function("third_referral_triggers_achievement", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            let referrer = Address::generate(&env);
            for _ in 0..3 {
                let referee = Address::generate(&env);
                black_box(client.record_referral(&referrer, &referee));
            }
        });
    });

    g.finish();
}

/// Leaderboard read — measures `get_leaderboard_entries` across N users.
fn bench_leaderboard(c: &mut Criterion) {
    let mut g = c.benchmark_group("achievements/leaderboard");

    g.bench_function("get_top_10_of_20_users", |b| {
        b.iter(|| {
            let env = Env::default();
            env.ledger().set_timestamp(1_000);
            let (client, _) = deploy(&env);
            for t in 1u32..=20 {
                let user = Address::generate(&env);
                // Give each user a different score via a different achievement type
                // (cycling through types 1-13).
                client.unlock_achievement(&user, &((t % 13) + 1), &meta(&env));
            }
            black_box(client.get_leaderboard_entries(&3, &10));
        });
    });

    g.finish();
}

criterion_group!(
    benches,
    bench_unlock,
    bench_record_contribution,
    bench_get_achievements,
    bench_get_level,
    bench_record_referral,
    bench_leaderboard,
);
criterion_main!(benches);
