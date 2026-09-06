// Seed data replicated from monday.com board "CAYMUS '25 (Anthony)" (board 3746667164), fetched 2026-07-14
(function () {
  const P = ["Signed Commitment", "DP - 90 Bank Stmt", "Income - LOE", "APS", "MLS", "ID", "APS - Waivers", "Income - Paystub", "Income - 2yr T4", "Income - BFS - 2yr T1", "Income - BFS - 2yr NOA", "Income - BFS - Articles/MBL", "DP - Gift Letter", "DP - Gift Deposit", "DP - Sold Property APS", "DP - Sale Trust Ledger", "Property - Mtg Stmt", "Property - Tax Bill", "Proof Debt Paid", "Property - Lease Agreement"];
  const R = ["Signed Commitment", "Income - LOE", "ID", "Income - Paystub", "Income - 2yr T4", "Income - BFS - 2yr T1", "Income - BFS - 2yr NOA", "Income - BFS - Articles/MBL", "Property - Mtg Stmt", "Property - Tax Bill", "Proof Debt Paid", "Status Cert Reminder?", "Property - Lease Agreement"];
  let sid = 1;
  const sub = (name, cond, date, details) => ({ id: "s" + (sid++), name: name, cond: cond || "Requested", date: date || null, details: details || null });
  const mk = (names, cond, date) => names.map(n => sub(n, cond, date));

  const item = (id, name, f) => Object.assign({ id: String(id), name: name, agent: null, deal: null, date: null, lender: [], vol: null, status: null, appraisal: "N/A", appraiser: null, instructed: "NO", broker: null, compliance: null, notes: null, email: null, subs: [] }, f);

  window.CAYMUS_SEED = {
    boardName: "CAYMUS '25 (Anthony)",
    boardDesc: "CAYMUS MORTGAGE CAPITAL",
    labels: {
      agent: [["Anthony", "#0073ea"], ["Chris", "#a25ddc"], ["Traynor", "#00c875"], ["Jennifer", "#e2445c"], ["Sean", "#fdab3d"]],
      status: [["Submitted", "#fdab3d"], ["Approved", "#00c875"], ["In Progress", "#74afcc"], ["Cancelled", "#333333"]],
      appraisal: [["Ordered", "#fdab3d"], ["Scheduled", "#66ccff"], ["Completed", "#00c875"], ["Need to Order", "#df2f4a"], ["N/A", "#c4c4c4"]],
      instructed: [["YES", "#00c875"], ["N/A", "#df2f4a"], ["NO", "#c4c4c4"]],
      broker: [["Complete", "#00c875"], ["Audit Done", "#333333"], ["Audit Req'd", "#fdab3d"]],
      compliance: [["Required", "#fdab3d"], ["Done", "#00c875"]],
      cond: [["Requested", "#c4c4c4"], ["Received", "#fdab3d"], ["Reviewed", "#4eccc6"], ["Uploaded", "#ffcb00"], ["Accepted", "#00c875"], ["Ordered", "#007eb5"]]
    },
    dropdowns: {
      agent: ["Anthony", "Chris", "Traynor", "Jennifer", "Sean"],
      deal: ["HELOC", "Purch", "Refi", "Switch", "Purch w/PPI", "Refi-Maturity"],
      lender: ["BMO", "DUCA", "EQB", "FN", "FN - Excalibur", "HT", "Lendwise", "MCAP", "Private", "Private - Interfinance", "Private - NH", "Private - Vault", "RFA", "RFA - B", "RFA-B", "RMG", "Scotia", "Scotia - IFP", "Strive", "Strive - Aspire", "TD"],
      appraiser: ["All Realty Consultants", "Appraisal2000", "Avison-Young", "AVM", "Crosstown", "FNF", "HOLD OFF", "HVI", "Insured", "Metrowide", "Murray Appraisals", "Musso", "NAS", "PVCI", "Reliable", "RPS", "S.W. Irvine", "Solidifi"]
    },
    subTemplates: { Purch: P, Refi: R },
    groups: [
      {
        id: "new_group78370", title: "Template", color: "#808080", items: [
          item(3746667459, "New Deal Purchase", { agent: "Anthony", deal: "Purch", vol: 0, subs: mk(P) }),
          item(12513412430, "Sanita, Christina", { agent: "Anthony", deal: "Purch", vol: 0, subs: mk(P) }),
          item(3746668170, "New Deal Refi", { agent: "Anthony", deal: "Refi", subs: mk(R) }),
          item(12383559672, "Kronick, Ilana", { agent: "Anthony", deal: "Refi", subs: mk(R) }),
          item(11525620724, "Jeffrey, Alex (rental)", { agent: "Anthony", deal: "Refi", subs: mk(R) })
        ]
      },
      {
        id: "group_mkxcz2d", title: "Leads", color: "#fdab3d", items: [
          item(11815645344, "Nguyen, Hoanh", { agent: "Anthony", deal: "Refi", subs: mk(R) }),
          item(8211256028, "Angheloni, Anthony", { agent: "Anthony", deal: "Purch", vol: 0, subs: mk(P) }),
          item(11828681096, "Hodge, Robyn and Stephen 16871", {})
        ]
      },
      {
        id: "new_group28550", title: "Submitted", color: "#a25ddc", items: [
          item(11518479213, "Vasiliou, Stephanie", { agent: "Anthony", deal: "Refi", status: "Submitted", subs: mk(R) }),
          item(12522437874, "Sheridan, Dara 17387", { agent: "Anthony", deal: "Refi-Maturity", date: "2026-09-01", lender: ["BMO"], vol: 470000, status: "Submitted", subs: mk(R) })
        ]
      },
      {
        id: "topics", title: "Active Deals", color: "#579bfc", items: [
          item(11766648045, "Kim, Diana 16630", { agent: "Anthony", deal: "Purch", date: "2026-07-31", lender: ["BMO"], vol: 517600, status: "Approved", subs: mk(P) })
        ]
      },
      {
        id: "next_month", title: "Broker Complete", color: "#00c875", items: [
          item(11722183180, "Ounjian, Ryan 16740", { agent: "Anthony", deal: "Purch", date: "2026-04-30", lender: ["BMO"], vol: 930000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", subs: mk(["Signed Commitment", "DP - 90 Bank Stmt", "Income - LOE", "APS", "MLS", "ID", "APS - Waivers", "Income - Paystub", "Income - 2yr T4", "DP - Sale Trust Ledger", "BMO PAD"], "Accepted", "2026-04-23") }),
          item(11533071879, "Bowman, Brandyn 16626", { agent: "Anthony", deal: "Switch", date: "2026-07-15", lender: ["Strive"], vol: 530000, status: "Approved", appraisal: "Completed", appraiser: "AVM", subs: mk(["Signed Commitment", "Income - LOE", "ID", "Income - Paystub", "Income - 2yr T4"], "Accepted", "2026-04-10").concat(mk(["Property - Mtg Stmt", "Property - Tax Bill", "FCT Payout Form"], "Accepted", "2026-06-03"), [sub("Debt paid by business", "Accepted", "2026-06-03", "Feb")]) }),
          item(11526609746, "Teixeira, Jonathan", { agent: "Anthony", deal: "Refi", date: "2026-05-15", lender: ["Scotia"], vol: 628973, status: "Approved", appraisal: "Completed", instructed: "YES", broker: "Complete", subs: mk(R, "Accepted", "2026-04-29") }),
          item(11736319714, "Salvador, Katrina 16840", { agent: "Anthony", deal: "Refi", date: "2026-06-04", lender: ["BMO"], vol: 725000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", subs: mk(R, "Accepted", "2026-06-03") }),
          item(10779238525, "Lobo, Dale", { date: "2026-06-03", lender: ["TD"], vol: 528000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete" })
        ]
      },
      { id: "new_group61209", title: "Funded - Compliance Required", color: "#df2f4a", items: [] },
      {
        id: "new_group", title: "Funded - Compliance Done", color: "#037f4c", items: [
          item(8268318220, "Kronick, Ilana 9258", { agent: "Anthony", deal: "Refi", date: "2025-01-02", lender: ["Scotia"], vol: 680000, status: "Approved", appraisal: "Completed", appraiser: "Solidifi", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(R, "Accepted", "2024-12-30") }),
          item(8225345099, "Gauci, Santino 12301", { agent: "Anthony", deal: "Purch", date: "2025-02-18", lender: ["MCAP"], vol: 380120, status: "Approved", appraisal: "Completed", appraiser: "Insured", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("APS - Status Waivers", "Accepted", "2025-01-31")].concat(mk(["Signed Commitment", "DP - 90 Bank Stmt", "APS - Waivers", "APS - Closing Amendment"], "Accepted", "2025-01-17"), [sub("ID", "Accepted", "2025-01-14")], mk(["Income - LOE", "APS", "MLS", "Income - Paystub", "Income - 2yr T4"], "Accepted", "2025-01-13")) }),
          item(7976950968, "Rawson, Gaynor 12440", { agent: "Anthony", deal: "Refi", date: "2025-02-28", lender: ["TD"], vol: 550000, status: "Approved", appraisal: "Completed", appraiser: "RPS", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(["Lawyer", "Condo Fee: 66 Ruffle"], "Accepted", "2025-01-24").concat(mk(["Signed Commitment", "Income - LOE", "ID", "Income - Paystub", "Property - Mtg Stmt"], "Accepted", "2025-01-15")) }),
          item(8386626191, "Jordan Collins 13250", { agent: "Anthony", deal: "Refi", date: "2025-02-28", lender: ["Scotia"], vol: 184700, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Signed Commitment", "Requested", "2025-02-06")].concat(mk(R.slice(1), "Accepted", "2025-02-06")) }),
          item(8485658091, "Unal, Hasan 13572", { agent: "Anthony", deal: "Refi", date: "2025-03-03", lender: ["EQB"], vol: 200000, status: "Approved", appraisal: "Completed", appraiser: "PVCI", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(R) }),
          item(8639604546, "Bailey, Chris 14334", { agent: "Anthony", deal: "Refi", date: "2025-04-04", lender: ["FN - Excalibur"], vol: 400000, status: "Approved", appraisal: "Completed", appraiser: "Avison-Young", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Lawyer LOD", "Accepted", "2025-04-10")].concat(mk(R, "Accepted", "2025-03-27")) }),
          item(8905184284, "Van Huizen, Lawrence 721", { agent: "Anthony", deal: "Refi", date: "2025-05-12", lender: ["Scotia"], vol: 650000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Income - CCB", "Accepted", "2025-04-24")].concat(mk(["Signed Commitment", "ID", "Property - Tax Bill"], "Accepted", "2025-04-16"), mk(["Income - LOE", "Income - Paystub", "Income - 2yr T4"], "Accepted", "2025-04-15")) }),
          item(8531746095, "Wiggins, Rob 14024", { agent: "Anthony", deal: "Refi", date: "2025-05-30", lender: ["Scotia", "MCAP"], vol: 544000, status: "Approved", appraisal: "Completed", appraiser: "RPS", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Income - Paystub", "Accepted", "2025-04-07", "Candice"), sub("Property - Tax Bill", "Accepted", "2025-04-07", "18 Frid")].concat(mk(["Signed Commitment", "ID"], "Accepted", "2025-04-03"), mk(["Income - LOE", "Income - 2yr T4", "Property - Mtg Stmt", "Property - Lease Agreement"], "Accepted", "2025-02-25")) }),
          item(8646540282, "Murphy, Sean 12408", { agent: "Anthony", deal: "Purch", date: "2025-06-09", lender: ["Scotia"], vol: 932000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Bridge Docs", "Accepted", "2025-05-12", "DocuSign + Home Insurance"), sub("DP - Sold Property APS", "Accepted", "2025-04-30")].concat(mk(P.filter(n => n !== "DP - Sold Property APS"), "Accepted", "2025-03-26")) }),
          item(8744180534, "Hunter, Matthew", { agent: "Anthony", deal: "Refi", date: "2025-06-09", lender: ["TD", "Scotia"], vol: 880000, status: "Approved", appraisal: "Completed", appraiser: "RPS", instructed: "YES", broker: "Complete", compliance: "Done", subs: [sub("Income - Paystub", "Accepted", "2025-05-12")].concat(mk(R.filter(n => n !== "Income - Paystub" && n !== "Property - Lease Agreement"), "Accepted", "2025-04-30"), [sub("Property - Lease Agreement", "Accepted", "2025-04-30")]) }),
          item(9362573333, "Szabo-Nicholson, Daryn 15623", { agent: "Anthony", deal: "Purch", date: "2025-07-18", lender: ["Scotia"], vol: 365600, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(P, "Accepted", "2025-06-30") }),
          item(9200364476, "Bourgault, Colleen 15745", { agent: "Anthony", deal: "Purch", date: "2025-08-07", lender: ["Scotia"], vol: 455000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(P, "Accepted", "2025-07-15") }),
          item(9437285158, "Usoltseva, Olena", { agent: "Anthony", deal: "Purch", date: "2025-09-15", lender: ["Strive"], vol: 578860, status: "Approved", appraisal: "Completed", appraiser: "Insured", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(P, "Accepted") }),
          item(18121766346, "Yeatman, Allison", { agent: "Anthony", deal: "Refi", date: "2025-11-17", lender: ["Scotia"], vol: 322000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(R) }),
          item(18353828836, "Ferguson, Bryan 17614", { agent: "Anthony", deal: "Refi-Maturity", date: "2025-12-12", lender: ["Scotia"], vol: 514000, status: "Approved", appraisal: "Completed", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(R, "Accepted", "2025-12-23") }),
          item(10758961939, "Collins, Jordan", { agent: "Anthony", deal: "Refi", date: "2026-02-11", lender: ["TD"], vol: 580000, status: "Approved", appraisal: "Completed", appraiser: "RPS", instructed: "YES", broker: "Complete", compliance: "Done", subs: mk(R, "Accepted", "2026-01-19") }),
          item(10868952142, "Sheryl Salvador", { date: "2026-02-19", lender: ["BMO"], vol: 765000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Required" }),
          item(10976038191, "Nelson, Curtis 15220", { agent: "Anthony", deal: "Purch", date: "2026-02-25", lender: ["Scotia"], vol: 664000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Required", subs: [sub("Branch Meeting", "Accepted", "2026-02-05")].concat(mk(P, "Accepted", "2026-01-19")) }),
          item(10992288371, "McDonell, Mitch 15344", { agent: "Anthony", deal: "Switch", date: "2026-03-06", lender: ["Scotia"], vol: 645746.33, status: "Approved", appraisal: "Completed", appraiser: "Insured", instructed: "YES", broker: "Complete", compliance: "Required", subs: [sub("CSA Branch Meeting", "Accepted", "2026-03-06")].concat(mk(R, "Accepted", "2026-02-06")) }),
          item(10986968562, "Skoko, April 15222", { agent: "Anthony", deal: "Purch", date: "2026-03-10", lender: ["Strive"], vol: 366520.5, status: "Approved", appraisal: "Completed", appraiser: "Insured", instructed: "YES", broker: "Complete", compliance: "Required", subs: mk(P, "Accepted", "2026-02-06") }),
          item(11184497689, "Hunter, Ben 15192", { agent: "Anthony", deal: "Purch", date: "2026-03-27", lender: ["BMO"], vol: 749000, status: "Approved", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", compliance: "Required", subs: [sub("P - Schedule B", "Accepted", "2026-03-11", "Sold Property"), sub("APS - Waivers", "Accepted", "2026-03-11"), sub("Property - Mtg Stmt", "Accepted", "2026-03-11", "382 Nipigon mtg/loc TD Stmt")].concat(mk(["Signed Commitment", "DP - 90 Bank Stmt", "Income - LOE", "APS", "MLS", "ID", "APS - Waivers", "Income - Paystub"], "Accepted", "2026-02-18"), [sub("Income - 2yr T4", "Accepted", "2026-03-16", "Need Cassie 2025 T4 or YE paystub")], mk(["Income - BFS - 2yr T1", "Income - BFS - 2yr NOA", "Income - BFS - Articles/MBL", "DP - Gift Letter", "DP - Gift Deposit", "DP - Sold Property APS", "DP - Sale Trust Ledger", "Property - Tax Bill", "Property - Lease Agreement", "Proof Debt Paid"], "Accepted", "2026-02-18")) }),
          item(9059247522, "Manchee, Marc", { agent: "Anthony", deal: "Refi", date: "2026-03-31", lender: ["Scotia"], vol: 880000, status: "Approved", appraisal: "Completed", appraiser: "RPS", instructed: "YES", broker: "Complete", compliance: "Required", subs: mk(R, "Accepted", "2026-03-24") })
        ]
      },
      { id: "new_group29674", title: "Paid", color: "#0086c0", items: [] },
      {
        id: "new_group92992", title: "Cancelled", color: "#333333", items: [
          item(7297090151, "Pagliuca, Linda", { agent: "Anthony", deal: "Refi", lender: ["HT"], vol: 610000, status: "Cancelled", appraisal: "Completed", appraiser: "HVI", subs: mk(R, "Accepted", "2024-10-18") }),
          item(8311796508, "Skene, Angus 12872", { agent: "Anthony", deal: "Purch", lender: ["MCAP"], vol: 540000, status: "Cancelled", appraisal: "Completed", appraiser: "AVM", instructed: "YES", broker: "Complete", subs: [sub("DP - 90 Bank Stmt", "Accepted", "2025-04-11"), sub("VOID", "Accepted", "2025-04-11")].concat(mk(P.filter(n => n !== "DP - 90 Bank Stmt"), "Accepted", "2025-03-27")) }),
          item(9396188435, "Henderson, Shaun 16281", { agent: "Anthony", deal: "Refi", lender: ["Scotia"], vol: 560000, status: "Cancelled", appraisal: "Ordered", appraiser: "RPS", subs: mk(R) }),
          item(10808478176, "Evan Short", {}),
          item(10926787917, "Nichole", { status: "Cancelled" }),
          item(10978549061, "Elliston, Jaye 15350 (o/o)", { agent: "Anthony", deal: "Refi", status: "Cancelled", subs: mk(R) }),
          item(11546678091, "Hetmanczuk, Tania", { agent: "Chris", deal: "Refi", vol: 0, status: "Cancelled", subs: mk(R) }),
          item(18349353867, "Colon, Rafael", { agent: "Anthony", deal: "Refi", vol: 0, status: "Cancelled", subs: mk(R) })
        ]
      }
    ]
  };
})();
