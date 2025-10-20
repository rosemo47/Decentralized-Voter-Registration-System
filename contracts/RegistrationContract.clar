(define-constant ERR_INVALID_IDENTITY u1000)
(define-constant ERR_DUPLICATE_REGISTRATION u1001)
(define-constant ERR_INVALID_JURISDICTION u1002)
(define-constant ERR_NOT_ADMIN u1003)
(define-constant ERR_REGISTRATION_NOT_FOUND u1004)
(define-constant ERR_INVALID_HASH u1005)
(define-constant ERR_INVALID_TITLE u1006)
(define-constant ERR_INVALID_DESCRIPTION u1007)
(define-constant ERR_INVALID_STATUS u1008)
(define-constant ERR_INVALID_ELIGIBILITY_SCORE u1009)
(define-constant ERR_INVALID_USER_PRINCIPAL u1010)
(define-constant ERR_INVALID_TIMESTAMP u1011)
(define-constant ERR_INVALID_USER_ID u1012)
(define-constant ERR_AUTHORITY_NOT_VERIFIED u1013)
(define-constant ERR_INVALID_MIN_AGE u1014)
(define-constant ERR_INVALID_MIN_RESIDENCY u1015)
(define-constant ERR_MAX_REGISTRATIONS_EXCEEDED u1016)
(define-constant ERR_INVALID_CURRENCY u1017)
(define-constant ERR_INVALID_LOCATION u1018)
(define-constant ERR_INVALID_GRACE_PERIOD u1019)
(define-constant ERR_INVALID_INTEREST_RATE u1020)

(define-data-var next-registration-id uint u0)
(define-data-var max-registrations uint u1000000)
(define-data-var registration-fee uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map registrations
  { user-id: (string-ascii 40), jurisdiction-id: (string-ascii 10) }
  {
    registration-hash: (string-ascii 64),
    title: (string-ascii 100),
    description: (string-ascii 500),
    timestamp: uint,
    status: (string-ascii 20),
    eligibility-score: uint
  }
)

(define-map jurisdiction-reg-counts
  { jurisdiction-id: (string-ascii 10) }
  uint
)

(define-map registration-updates
  { user-id: (string-ascii 40), jurisdiction-id: (string-ascii 10) }
  {
    update-title: (string-ascii 100),
    update-description: (string-ascii 500),
    update-timestamp: uint,
    updater: principal
  }
)

(define-trait identity-trait
  (
    (get-identity-hash (principal) (response (string-ascii 64) uint))
    (is-valid-user (principal) bool)
  )
)

(define-trait jurisdiction-trait
  (
    (is-valid-jurisdiction ((string-ascii 10)) bool)
    (get-rules ((string-ascii 10)) (response { min-age: uint, min-residency: uint } uint))
  )
)

(define-trait audit-trait
  (
    (log-event ((string-ascii 200) (string-ascii 64)) (response bool uint))
  )
)

(define-trait admin-trait
  (
    (is-admin (principal) bool)
  )
)

(define-trait eligibility-trait
  (
    (compute-score ({ min-age: uint, min-residency: uint, user-data: (string-ascii 256) }) (response uint uint))
  )
)

(define-read-only (get-registration (user-id (string-ascii 40)) (jurisdiction-id (string-ascii 10)))
  (map-get? registrations { user-id: user-id, jurisdiction-id: jurisdiction-id })
)

(define-read-only (get-registration-updates (user-id (string-ascii 40)) (jurisdiction-id (string-ascii 10)))
  (map-get? registration-updates { user-id: user-id, jurisdiction-id: jurisdiction-id })
)

(define-read-only (get-jurisdiction-reg-count (jurisdiction-id (string-ascii 10)))
  (default-to u0 (map-get? jurisdiction-reg-counts { jurisdiction-id: jurisdiction-id }))
)

(define-private (validate-hash (hash (string-ascii 64)))
  (if (and (> (len hash) u0) (<= (len hash) u64))
      (ok true)
      (err ERR_INVALID_HASH))
)

(define-private (validate-title (title (string-ascii 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR_INVALID_TITLE))
)

(define-private (validate-description (desc (string-ascii 500)))
  (if (<= (len desc) u500)
      (ok true)
      (err ERR_INVALID_DESCRIPTION))
)

(define-private (validate-status (status (string-ascii 20)))
  (if (or (is-eq status "active") (is-eq status "archived") (is-eq status "pending"))
      (ok true)
      (err ERR_INVALID_STATUS))
)

(define-private (validate-eligibility-score (score uint))
  (if (and (>= score u0) (<= score u100))
      (ok true)
      (err ERR_INVALID_ELIGIBILITY_SCORE))
)

(define-private (validate-user-principal (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR_INVALID_USER_PRINCIPAL))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR_INVALID_TIMESTAMP))
)

(define-private (validate-user-id (id (string-ascii 40)))
  (if (and (> (len id) u0) (<= (len id) u40))
      (ok true)
      (err ERR_INVALID_USER_ID))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-user-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-registrations (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR_MAX_REGISTRATIONS_EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set max-registrations new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR_INVALID_HASH))
    (asserts! (is-some (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-voter
  (user-principal principal)
  (user-id (string-ascii 40))
  (jurisdiction-id (string-ascii 10))
  (registration-hash (string-ascii 64))
  (title (string-ascii 100))
  (description (string-ascii 500))
)
  (let
    (
      (next-id (var-get next-registration-id))
      (current-max (var-get max-registrations))
      (authority (var-get authority-contract))
      (identity-hash (unwrap! (as-contract (contract-call? .identity-contract get-identity-hash user-principal)) (err ERR_INVALID_IDENTITY)))
      (is-valid-j (as-contract (contract-call? .jurisdiction-contract is-valid-jurisdiction jurisdiction-id)))
      (rules (unwrap! (as-contract (contract-call? .jurisdiction-contract get-rules jurisdiction-id)) (err ERR_INVALID_JURISDICTION)))
      (existing-reg (map-get? registrations { user-id: user-id, jurisdiction-id: jurisdiction-id }))
      (score (unwrap! (as-contract (contract-call? .eligibility-contract compute-score { min-age: (get min-age rules), min-residency: (get min-residency rules), user-data: registration-hash })) (err ERR_INVALID_ELIGIBILITY_SCORE)))
    )
    (asserts! (< next-id current-max) (err ERR_MAX_REGISTRATIONS_EXCEEDED))
    (try! (validate-user-id user-id))
    (try! (validate-hash registration-hash))
    (try! (validate-title title))
    (try! (validate-description description))
    (asserts! (is-eq identity-hash user-id) (err ERR_INVALID_IDENTITY))
    (asserts! is-valid-j (err ERR_INVALID_JURISDICTION))
    (asserts! (is-none existing-reg) (err ERR_DUPLICATE_REGISTRATION))
    (let ((authority-recipient (unwrap! authority (err ERR_AUTHORITY_NOT_VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (let
      (
        (new-reg {
          registration-hash: registration-hash,
          title: title,
          description: description,
          timestamp: block-height,
          status: "active",
          eligibility-score: score
        })
      )
      (map-set registrations { user-id: user-id, jurisdiction-id: jurisdiction-id } new-reg)
      (map-set jurisdiction-reg-counts { jurisdiction-id: jurisdiction-id }
        (+ (default-to u0 (map-get? jurisdiction-reg-counts { jurisdiction-id: jurisdiction-id })) u1))
      (as-contract (try! (contract-call? .audit-contract log-event
        (concat "New registration: user " user-id)
        registration-hash)))
      (var-set next-registration-id (+ next-id u1))
      (print { event: "voter-registered", id: next-id })
      (ok new-reg)
    )
  )
)

(define-public (update-registration
  (user-id (string-ascii 40))
  (jurisdiction-id (string-ascii 10))
  (update-title (string-ascii 100))
  (update-description (string-ascii 500))
)
  (let ((reg (map-get? registrations { user-id: user-id, jurisdiction-id: jurisdiction-id })))
    (match reg
      r
        (begin
          (asserts! (as-contract (contract-call? .admin-contract is-admin tx-sender)) (err ERR_NOT_ADMIN))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (map-set registrations { user-id: user-id, jurisdiction-id: jurisdiction-id }
            (merge r {
              title: update-title,
              description: update-description,
              timestamp: block-height
            }))
          (map-set registration-updates { user-id: user-id, jurisdiction-id: jurisdiction-id }
            {
              update-title: update-title,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender
            })
          (print { event: "registration-updated", user-id: user-id, jurisdiction-id: jurisdiction-id })
          (ok true)
        )
      (err ERR_REGISTRATION_NOT_FOUND)
    )
  )
)

(define-public (update-registration-status
  (user-id (string-ascii 40))
  (jurisdiction-id (string-ascii 10))
  (new-status (string-ascii 20))
)
  (let ((reg (map-get? registrations { user-id: user-id, jurisdiction-id: jurisdiction-id })))
    (match reg
      r
        (begin
          (asserts! (as-contract (contract-call? .admin-contract is-admin tx-sender)) (err ERR_NOT_ADMIN))
          (try! (validate-status new-status))
          (map-set registrations { user-id: user-id, jurisdiction-id: jurisdiction-id }
            (merge r { status: new-status, timestamp: block-height }))
          (ok true)
        )
      (err ERR_REGISTRATION_NOT_FOUND)
    )
  )
)

(define-public (get-registration-count)
  (ok (var-get next-registration-id))
)