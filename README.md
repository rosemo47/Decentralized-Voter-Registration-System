# 🗳️ Decentralized Voter Registration System

Welcome to a revolutionary decentralized voter registration platform built on the Stacks blockchain! This project addresses the real-world challenge faced by migrants who move across jurisdictions (e.g., countries, states, or regions), often losing or complicating their voting rights due to fragmented, centralized systems. By leveraging blockchain, we enable secure, immutable, and verifiable voter registrations that can be checked transparently across borders without relying on a single authority. This promotes fair elections, reduces fraud, and empowers mobile populations like refugees, expatriates, and seasonal workers.

## ✨ Features

🔐 Secure identity registration with cryptographic proofs  
🌍 Cross-jurisdiction verification for migrants  
⏰ Immutable timestamps for all registrations and updates  
📝 Track migration history to maintain voting eligibility  
✅ Instant eligibility checks for voting  
🚫 Prevent double-registration or fraud through unique hashes  
🔍 Audit trails for transparency and dispute resolution  
🤝 Interoperable with multiple jurisdictions via smart contract interactions  
💡 Incentive mechanisms for verifiers (optional token rewards)

## 🛠 How It Works

This system uses Clarity smart contracts on the Stacks blockchain to create a tamper-proof ledger for voter data. Users (voters) register their identity once and can then apply for voter status in specific jurisdictions. When migrating, they update their records, which are verifiable by election officials or verifiers in any participating jurisdiction. All actions are logged immutably.

The project involves 8 smart contracts to handle various aspects of the system, ensuring modularity, security, and scalability:

1. **IdentityContract.clar**: Manages user identities by storing hashed personal data (e.g., name, DOB, biometric hash) and issuing unique IDs. Prevents duplicate identities.
2. **JurisdictionContract.clar**: Defines and registers jurisdictions (e.g., by country code or region). Allows admins to add/update jurisdiction details like eligibility rules.
3. **RegistrationContract.clar**: Handles initial voter registration in a jurisdiction, linking to the user's identity and storing proof of residency.
4. **MigrationContract.clar**: Tracks when a user moves jurisdictions, transferring or archiving old registrations while creating new ones. Ensures no overlapping active votes.
5. **VerificationContract.clar**: Provides functions to verify a user's registration status, eligibility, and history across jurisdictions using cross-contract calls.
6. **EligibilityContract.clar**: Checks voting eligibility based on rules (e.g., age, residency duration) pulled from JurisdictionContract. Can integrate external oracles for real-time checks.
7. **AuditContract.clar**: Logs all actions (registrations, migrations, verifications) with timestamps and hashes for public auditing.
8. **AdminContract.clar**: Manages administrative roles, such as adding jurisdictions or resolving disputes, with multi-signature security.

**For Voters (Users)**

- Generate a SHA-256 hash of your identity documents.
- Call `register-identity` in IdentityContract with your hash and details.
- Use RegistrationContract's `register-voter` to apply in your current jurisdiction, providing proof (e.g., hashed residency docs).
- When migrating, invoke MigrationContract's `transfer-jurisdiction` with the new jurisdiction ID—your old registration is archived, and a new one is created.

Boom! Your voting rights are now portable and verifiable worldwide.

**For Verifiers (Election Officials or Apps)**

- Use VerificationContract's `verify-user` to check a voter's ID against their claimed jurisdiction.
- Call EligibilityContract's `check-eligibility` to confirm they meet voting criteria.
- Access AuditContract's `get-log` for a full history trail to detect any anomalies.

That's it! Secure, decentralized voting registration that scales for global mobility.

## 🚀 Getting Started

1. Install the Stacks CLI and Clarity tools.
2. Deploy the contracts in order (starting with IdentityContract).
3. Test interactions using the Stacks testnet.
4. Integrate with a frontend (e.g., React app) for user-friendly registration.

This project promotes democracy in a borderless world—let's make voting accessible for everyone!