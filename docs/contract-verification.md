# Contract Deployment Verification

Anyone can independently verify that the WASM bytecode deployed on Stellar matches the audited source code in this repository.

## Prerequisites

- Rust toolchain (1.86.0) with `wasm32-unknown-unknown` target
- `sha256sum` (on macOS: `shasum -a 256`)
- Git

## Step-by-step verification

### 1. Clone the exact commit used in the deployment

```bash
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause
git checkout <SOURCE_COMMIT>
```

The source commit is published in the [latest release](https://github.com/Fund-My-Cause/Fund-My-Cause/releases) and displayed in the frontend footer.

### 2. Build the WASM artifacts

```bash
cargo build --release --target wasm32-unknown-unknown
```

This produces `.wasm` files in `target/wasm32-unknown-unknown/release/`.

### 3. Compute the hash

```bash
sha256sum target/wasm32-unknown-unknown/release/crowdfund.wasm
sha256sum target/wasm32-unknown-unknown/release/registry.wasm
```

### 4. Compare with the published hash

The published hashes can be obtained from any of these sources:

- **Frontend footer**: Visit the app and look for the "Contract Hash" entry in the footer
- **Deployment attestation**: JSON artefact published alongside each release
- **GitHub Actions**: The `Reproducible WASM Build` workflow publishes hashes as a workflow artifact

### 5. Verify on-chain

```bash
stellar contract info --id <CONTRACT_ID> --network <NETWORK>
```

Compare the on-chain WASM hash with your locally computed SHA-256.

> **Note**: Soroban reports WASM hashes as hex-encoded SHA-256. The hash shown in the frontend and attestation file is also SHA-256 and should match.

## Reproducible builds

This project enforces deterministic (reproducible) WASM builds via the `Reproducible WASM Build` GitHub Actions workflow. The workflow:

1. Builds all contracts
2. Cleans and rebuilds from scratch
3. Compares SHA-256 hashes of both builds

If the hashes differ, the workflow fails. See [reproducible-wasm.yml](../.github/workflows/reproducible-wasm.yml) for details.

## Automated verification script

A script is provided at `scripts/verify-deployment.sh` that automates the comparison:

```bash
./scripts/verify-deployment.sh <CONTRACT_ID> [network]
```

This script:
- Fetches the on-chain WASM hash via `stellar contract info`
- Builds the contracts from source
- Compares the local SHA-256 with the on-chain hash
- Generates a verification report JSON

## Trust model

Verification proves that the deployed WASM bytecode matches a specific source commit. Users should:

1. Verify the source commit matches the audited commit (published in release notes)
2. Confirm the WASM hash displayed in the frontend matches their locally built hash
3. Cross-reference with the GitHub Actions reproducible build artifact

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Hash mismatch | Wrong git commit, different Rust toolchain version, or modified Cargo files |
| `stellar` command not found | Install the Stellar CLI: `cargo install stellar-cli` |
| WASM file not found after build | Ensure `wasm32-unknown-unknown` target is installed: `rustup target add wasm32-unknown-unknown` |
