/// Validation logic for the crowdfund contract.
///
/// This module contains validation functions for campaign parameters and operations.
use crate::errors::ContractError;
use crate::types::{Category, Status};
use soroban_sdk::Address;

/// Validates campaign initialization parameters.
///
/// # Arguments
/// * `goal` - Campaign funding goal
/// * `deadline` - Campaign deadline timestamp
/// * `min_contribution` - Minimum contribution amount
/// * `max_contribution` - Maximum contribution amount
/// * `platform_fee_bps` - Platform fee in basis points
/// * `current_time` - Current ledger timestamp
///
/// # Returns
/// * `Ok(())` if all parameters are valid
/// * `Err(ContractError)` if any parameter is invalid
pub fn validate_initialization(
    goal: i128,
    deadline: u64,
    min_contribution: i128,
    max_contribution: i128,
    platform_fee_bps: Option<u32>,
    current_time: u64,
) -> Result<(), ContractError> {
    if goal <= 0 {
        return Err(ContractError::InvalidGoal);
    }
    if deadline <= current_time {
        return Err(ContractError::InvalidDeadline);
    }
    if min_contribution < 0 {
        return Err(ContractError::BelowMinimum);
    }
    if max_contribution < 0 || (max_contribution > 0 && max_contribution < min_contribution) {
        return Err(ContractError::ExceedsMaximum);
    }
    if let Some(fee_bps) = platform_fee_bps {
        if fee_bps > 10_000 {
            return Err(ContractError::InvalidFee);
        }
    }
    Ok(())
}

/// Validates a contribution amount.
///
/// # Arguments
/// * `amount` - Contribution amount
/// * `min_contribution` - Minimum allowed contribution
/// * `max_contribution` - Maximum allowed contribution per contributor
/// * `current_contribution` - Current total contribution by this address
///
/// # Returns
/// * `Ok(())` if amount is valid
/// * `Err(ContractError)` if amount is invalid
pub fn validate_contribution_amount(
    amount: i128,
    min_contribution: i128,
    max_contribution: i128,
    current_contribution: i128,
) -> Result<(), ContractError> {
    if amount < min_contribution {
        return Err(ContractError::BelowMinimum);
    }
    if max_contribution > 0 {
        let new_total = current_contribution
            .checked_add(amount)
            .ok_or(ContractError::Overflow)?;
        if new_total > max_contribution {
            return Err(ContractError::ExceedsMaximum);
        }
    }
    Ok(())
}

/// Validates campaign status for operations.
///
/// # Arguments
/// * `status` - Current campaign status
/// * `required_status` - Required status for the operation
///
/// # Returns
/// * `Ok(())` if status matches
/// * `Err(ContractError::NotActive)` if status doesn't match
pub fn validate_status(status: Status, required_status: Status) -> Result<(), ContractError> {
    if status != required_status {
        return Err(ContractError::NotActive);
    }
    Ok(())
}

/// Validates campaign deadline has passed.
///
/// # Arguments
/// * `current_time` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
///
/// # Returns
/// * `Ok(())` if deadline has passed
/// * `Err(ContractError::CampaignStillActive)` if deadline hasn't passed
pub fn validate_deadline_passed(current_time: u64, deadline: u64) -> Result<(), ContractError> {
    if current_time < deadline {
        return Err(ContractError::CampaignStillActive);
    }
    Ok(())
}

/// Validates campaign deadline hasn't passed.
///
/// # Arguments
/// * `current_time` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
///
/// # Returns
/// * `Ok(())` if deadline hasn't passed
/// * `Err(ContractError::CampaignEnded)` if deadline has passed
pub fn validate_deadline_not_passed(current_time: u64, deadline: u64) -> Result<(), ContractError> {
    if current_time >= deadline {
        return Err(ContractError::CampaignEnded);
    }
    Ok(())
}

/// Validates goal has been reached.
///
/// # Arguments
/// * `total_raised` - Total amount raised
/// * `goal` - Campaign goal
///
/// # Returns
/// * `Ok(())` if goal is reached
/// * `Err(ContractError::GoalNotReached)` if goal is not reached
pub fn validate_goal_reached(total_raised: i128, goal: i128) -> Result<(), ContractError> {
    if total_raised < goal {
        return Err(ContractError::GoalNotReached);
    }
    Ok(())
}

/// Validates goal has not been reached.
///
/// # Arguments
/// * `total_raised` - Total amount raised
/// * `goal` - Campaign goal
///
/// # Returns
/// * `Ok(())` if goal is not reached
/// * `Err(ContractError::GoalReached)` if goal is reached
pub fn validate_goal_not_reached(total_raised: i128, goal: i128) -> Result<(), ContractError> {
    if total_raised >= goal {
        return Err(ContractError::GoalReached);
    }
    Ok(())
}

/// Validates a new deadline is later than current deadline.
///
/// # Arguments
/// * `new_deadline` - Proposed new deadline
/// * `current_deadline` - Current deadline
///
/// # Returns
/// * `Ok(())` if new deadline is later
/// * `Err(ContractError::InvalidDeadline)` if new deadline is not later
pub fn validate_deadline_extension(
    new_deadline: u64,
    current_deadline: u64,
) -> Result<(), ContractError> {
    if new_deadline <= current_deadline {
        return Err(ContractError::InvalidDeadline);
    }
    Ok(())
}

/// Validates insurance fee configuration.
///
/// # Arguments
/// * `fee_bps` - Insurance fee in basis points
///
/// # Returns
/// * `Ok(())` if fee is valid
/// * `Err(ContractError::InvalidFee)` if fee is invalid
pub fn validate_insurance_fee(fee_bps: u32) -> Result<(), ContractError> {
    if fee_bps > 10_000 {
        return Err(ContractError::InvalidFee);
    }
    Ok(())
}

/// Validates recurring plan parameters.
///
/// # Arguments
/// * `amount` - Contribution amount
/// * `interval` - Interval in seconds
/// * `end_date` - End date timestamp
/// * `current_time` - Current ledger timestamp
///
/// # Returns
/// * `Ok(())` if parameters are valid
/// * `Err(ContractError::InvalidRecurringPlan)` if parameters are invalid
pub fn validate_recurring_plan(
    amount: i128,
    interval: u64,
    end_date: u64,
    current_time: u64,
) -> Result<(), ContractError> {
    if amount <= 0 || interval == 0 || end_date <= current_time {
        return Err(ContractError::InvalidRecurringPlan);
    }
    Ok(())
}

/// Validates delegation parameters.
///
/// # Arguments
/// * `amount` - Delegated amount
///
/// # Returns
/// * `Ok(())` if parameters are valid
/// * `Err(ContractError::InvalidDelegation)` if parameters are invalid
pub fn validate_delegation(amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidDelegation);
    }
    Ok(())
}

/// Validates partial refund amount.
///
/// # Arguments
/// * `refund_amount` - Amount to refund
/// * `total_contribution` - Total contribution by the address
///
/// # Returns
/// * `Ok(())` if refund is valid
/// * `Err(ContractError::RefundLimitExceeded)` if refund exceeds limit
pub fn validate_partial_refund(
    refund_amount: i128,
    total_contribution: i128,
) -> Result<(), ContractError> {
    if refund_amount > total_contribution / 2 {
        return Err(ContractError::RefundLimitExceeded);
    }
    Ok(())
}

/// Validates message length.
///
/// # Arguments
/// * `message_len` - Length of the message
///
/// # Returns
/// * `Ok(())` if message is valid
/// * `Err(ContractError::MessageTooLong)` if message is too long
pub fn validate_message_length(message_len: usize) -> Result<(), ContractError> {
    if message_len > 256 {
        return Err(ContractError::MessageTooLong);
    }
    Ok(())
}

/// Validates a Soroban `String` is non-empty and within `max_len` characters.
///
/// # Arguments
/// * `s` - The string to validate
/// * `max_len` - Maximum allowed length (inclusive)
///
/// # Returns
/// * `Ok(())` if valid
/// * `Err(ContractError::StringEmpty)` if the string is empty
/// * `Err(ContractError::StringTooLong)` if the string exceeds `max_len`
pub fn validate_string_length(s: &soroban_sdk::String, max_len: u32) -> Result<(), ContractError> {
    let len = s.len();
    if len == 0 {
        return Err(ContractError::StringEmpty);
    }
    if len > max_len {
        return Err(ContractError::StringTooLong);
    }
    Ok(())
}

/// Validates that an `i128` amount is strictly positive (> 0).
///
/// # Arguments
/// * `amount` - The amount to validate
///
/// # Returns
/// * `Ok(())` if amount > 0
/// * `Err(ContractError::AmountNotPositive)` otherwise
pub fn validate_positive_amount(amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::AmountNotPositive);
    }
    Ok(())
}

/// Validates that the platform fee address is not the same as the creator.
///
/// Prevents the creator from routing the platform fee back to themselves,
/// which would be misleading to contributors.
///
/// # Arguments
/// * `creator` - Campaign creator address
/// * `fee_address` - Platform fee recipient address
///
/// # Returns
/// * `Ok(())` if addresses differ
/// * `Err(ContractError::SelfFeeAddress)` if they are the same
pub fn validate_address_not_self(
    creator: &Address,
    fee_address: &Address,
) -> Result<(), ContractError> {
    if creator == fee_address {
        return Err(ContractError::SelfFeeAddress);
    }
    Ok(())
}

/// Validates a fee in basis points is within the allowed range (0–10 000).
///
/// # Arguments
/// * `fee_bps` - Fee in basis points
///
/// # Returns
/// * `Ok(())` if fee_bps <= 10_000
/// * `Err(ContractError::InvalidFee)` otherwise
pub fn validate_fee_bps(fee_bps: u32) -> Result<(), ContractError> {
    if fee_bps > 10_000 {
        return Err(ContractError::InvalidFee);
    }
    Ok(())
}

/// Validates that a non-cancelled campaign is refundable (deadline passed, goal not met).
///
/// Call this only when `status != Cancelled`; the cancelled path skips all checks.
/// Combining the deadline and goal checks into one function allows both
/// `refund_single` and `refund_batch` to share the same short-circuit logic.
///
/// # Arguments
/// * `now` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
/// * `total` - Total amount raised
/// * `goal` - Campaign funding goal
///
/// # Returns
/// * `Ok(())` if the campaign is eligible for refunds
/// * `Err(ContractError::CampaignStillActive)` if the deadline has not passed
/// * `Err(ContractError::GoalReached)` if the goal was met
pub fn validate_refund_eligibility(
    now: u64,
    deadline: u64,
    total: i128,
    goal: i128,
) -> Result<(), ContractError> {
    if now < deadline {
        return Err(ContractError::CampaignStillActive);
    }
    if total >= goal {
        return Err(ContractError::GoalReached);
    }
    Ok(())
}

/// Validates that a goal value will not cause overflow when used in arithmetic.
///
/// Specifically checks that `goal` fits safely within the positive half of `i128`
/// (i.e. <= `i128::MAX / 2`) so that doubling or accumulating totals against it
/// cannot silently wrap.
///
/// # Arguments
/// * `goal` - Campaign funding goal
///
/// # Returns
/// * `Ok(())` if goal is safe
/// * `Err(ContractError::GoalOverflow)` if goal is dangerously large
pub fn validate_goal_not_overflow(goal: i128) -> Result<(), ContractError> {
    if goal > i128::MAX / 2 {
        return Err(ContractError::GoalOverflow);
    }
    Ok(())
}

/// Validates that a category is one of the allowed on-chain values.
///
/// Because `Category` is a `#[contracttype]` enum, Soroban will reject unknown
/// discriminants at decode time. This function provides an explicit, in-contract
/// check that returns a clear error for any future path that might bypass the
/// normal ABI decode (e.g., direct storage writes in tests or upgrades).
///
/// # Returns
/// * `Ok(())` for any valid `Category` variant
/// * `Err(ContractError::InvalidCategory)` for unrecognised values
pub fn validate_category(category: &Category) -> Result<(), ContractError> {
    match category {
        Category::Charity
        | Category::Technology
        | Category::Creative
        | Category::Event
        | Category::Personal
        | Category::Other => Ok(()),
        #[allow(unreachable_patterns)]
        _ => Err(ContractError::InvalidCategory),
    }
}

/// Validates a multi-sig governance configuration.
///
/// A configuration is valid only when there is at least one governor, at least
/// one required approval, and the required-approval threshold does not exceed the
/// number of governors (otherwise no proposal could ever be executed).
///
/// # Arguments
/// * `required_approvals` - Minimum approvals needed to execute a proposal
/// * `num_governors` - Number of governor addresses configured
/// * `timelock_delay` - Timelock delay in seconds (currently unrestricted, but
///   validated for presence to keep the signature stable)
///
/// # Returns
/// * `Ok(())` if the configuration is internally consistent
/// * `Err(ContractError::InvalidInput)` otherwise
pub fn validate_governance_config(
    required_approvals: u32,
    num_governors: u32,
    timelock_delay: u64,
) -> Result<(), ContractError> {
    let _ = timelock_delay; // no upper/lower bound enforced yet
    if num_governors == 0 || required_approvals == 0 || required_approvals > num_governors {
        return Err(ContractError::InvalidInput);
    }
    Ok(())
}
