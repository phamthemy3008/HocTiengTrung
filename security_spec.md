# Security Specification: HanziSRS

## 1. Data Invariants
- Users can only read and write their own profile (`users/{userId}` where `userId == request.auth.uid`).
- Decks can only be created by authenticated users whose `request.auth.uid == incoming().userId`.
- Decks can only be updated/deleted by their owner (`existing().userId == request.auth.uid`).
- Cards must belong to a valid user (`userId == request.auth.uid`) and deck. Only the card owner can read, update, or delete cards.
- Study logs can only be created by the owner (`userId == request.auth.uid`) and cannot be updated after creation (immutable audit log).
- Verified emails only (`request.auth.token.email_verified == true`).
- String lengths and types are strictly bounded.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Read on /users/abc**: Attempt to read user profile without auth -> DENIED.
2. **Identity Spoofing on Deck Creation**: User A submits deck with `userId: "user_B"` -> DENIED.
3. **Ghost Field Injection in Card**: Payload contains extra unexpected key `adminEscalation: true` -> DENIED.
4. **Denial of Wallet Oversized String**: Card with `hanzi` longer than 64 characters -> DENIED.
5. **Malicious ID Path Poisoning**: Attempt to write to `/cards/%2e%2e%2fhack` -> DENIED.
6. **Cross-User Deck Modification**: User A attempts to update title of User B's deck -> DENIED.
7. **Cross-User Card Deletion**: User A attempts to delete User B's card -> DENIED.
8. **Tampering Study Log**: Attempt to update an existing immutable study log -> DENIED.
9. **Unverified Email Access**: Write attempt with `request.auth.token.email_verified == false` -> DENIED.
10. **Card SRS Ease Factor Poisoning**: Non-numeric or negative easeFactor -> DENIED.
11. **Blanket Query Scraping**: Attempting to query all cards across users without `userId == request.auth.uid` filter -> DENIED.
12. **Status Escalation**: Card status set to invalid status string -> DENIED.

## 3. Security Assertions
- `allow read, write: if false;` catch-all global safety net.
- `allow list` explicitly validates `resource.data.userId == request.auth.uid`.
- Timestamps and immutability enforced for `createdAt` and `ownerId`.
