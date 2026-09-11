// Mirrors the prototype's AUTOS list (design-reference/CAYMUS 25 Board.dc.html).
// Each key is enforced server-side by a Postgres trigger (items_automations /
// subitems_automations) or the daily generate_notifications() job — this list
// is UI-only, for the toggle panel.
export const AUTOMATION_DEFS = [
  { key: 'moveSubmitted', text: 'When Status changes to "Submitted", move deal to Submitted' },
  { key: 'updateSubmitted', text: 'When Status changes to "Submitted", post update "{deal} submitted to {lender}"' },
  { key: 'moveApproved', text: 'When Status changes to "Approved", move deal to Active Deals' },
  { key: 'moveCancelled', text: 'When Status changes to "Cancelled", move deal to Cancelled' },
  { key: 'updateApproved', text: 'When Status changes to "Approved", post a pre-made update' },
  { key: 'moveBroker', text: 'When Broker Complete changes to "Complete", move deal to Broker Complete' },
  { key: 'moveCompReq', text: 'When Compliance changes to "Required", move deal to Funded - Compliance Required' },
  { key: 'moveCompDone', text: 'When Compliance changes to "Done", move deal to Funded - Compliance Done' },
  { key: 'updateApprOrdered', text: 'When Appraisal changes to "Ordered", post update "Appraisal ordered through {appraiser}"' },
  { key: 'updateApprDone', text: 'When Appraisal changes to "Completed", post a pre-made update' },
  { key: 'subDateStamp', text: 'When a subitem condition changes, set its date to the current date' },
  { key: 'notifSubmitted', text: 'Every day, if Status is "Submitted", notify: "Follow up with {lender} on Submission Status"' },
  { key: 'notifInstruct', text: '10 days before Closing Date, if not instructed, notify: "Confirm instructions are sent ASAP with {lender}!!"' },
  { key: 'notifClosing', text: 'When Closing Date arrives, notify: "{deal} is closing today!"' },
];
