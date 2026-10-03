# External labs and insurance workflows

Each clinic owns its own vendors, cases, statements, payers, patient coverage, claims and batches. Staff update external responses inside Planora; external laboratories and payers do not get Planora accounts.

## External dental labs

1. Register a laboratory and create a case from a patient. Link a treatment when relevant. Record the work, teeth, material, shade, instructions, due date and quoted cost.
2. Update the case as it is sent, produced, delivered and fitted. A remake remains on the same case with a note and incremented remake count.
3. Select unbilled cases from one laboratory to create a statement. The statement retains every case and its quoted cost.
4. Record a statement payment as allocations to individual cases. A payment cannot exceed a case's remaining cost. Each allocation also creates a laboratory expense and finance transaction.
5. Case history records the staff member, action and time. PDF, JPEG and PNG files up to 5 MB can be attached to each case.

## Insurance

1. Register a payer as private/TPA or Egyptian universal health insurance, then record the patient's member number, expiry and referral number where applicable.
2. Create a claim linked to a treatment. Track eligibility, authorization, submission, adjudication and the approved amount. The estimated patient share is stored separately from the insurer amount.
3. Leave a claim unbatched for individual settlement or group submitted/approved claims from one payer into a batch. The batch retains per-claim amounts and decisions.
4. Record each insurer payment against one or more claims. Each allocation is capped by the approved amount and outstanding treatment revenue, and creates a payment in Finance. A partially paid claim remains open.
5. Claim history records the staff member, action and time. PDF, JPEG and PNG supporting documents up to 5 MB can be attached.

Universal health insurance is tracked manually with contract, member, referral, authorization and claim references. Planora does not submit to or verify eligibility against the UHIA portal. Contract-specific copays, covered procedures and required approvals must be confirmed by the clinic; staff should not bill a denied balance to a patient automatically.

Existing clinic owner roles receive all six new permissions on migration. Doctors can view and update laboratory cases and view insurance. Reception staff can manage cases and claims. Only a clinic owner (or a role later granted `Lab.Settle` / `Insurance.Settle`) can record settlements.
