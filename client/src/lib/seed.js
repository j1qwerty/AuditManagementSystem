// Seed data for the workspace. Everything is generated relative to *today* so
// the data always looks live (overdue items, upcoming audits, recent activity).
// Only runs on first launch (or after a reset) - see DataContext.
import config from './config.js'
import { uid, isoDaysAgo, clamp, makePdf, stableIp as ipFor } from './utils.js'
import { seededRandom } from './utils.js'
import { defaultRolePermissions } from './permissions.js'

const fy = config.fiscalYear                       // e.g. "2026-27"
const fyStart = Number(fy.split('-')[0])           // e.g. 2026
const prevFy = `${fyStart - 1}-${String(fyStart % 100).padStart(2, '0')}`

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString()
const ago = isoDaysAgo

// ---------------------------------------------------------------- users
const WORKSPACE_USERS = [
  ['u_admin', 'Arjun Verma', 'arjun.verma@auditms.in', 'admin', 'System Administrator', null, '#70428a'],
  ['u_director', 'Dr. Meena Sharma', 'meena.sharma@auditms.in', 'director', 'Audit Director', null, '#b45309'],
  ['u_cao', 'Rajesh Kumar Singh', 'rajesh.singh@auditms.in', 'cao', 'Chief Audit Officer', null, '#0f766e'],
  ['u_senior1', 'Priya Yadav', 'priya.yadav@auditms.in', 'senior', 'Senior Audit Officer', null, '#036dc9'],
  ['u_senior2', 'Vikram Chauhan', 'vikram.chauhan@auditms.in', 'senior', 'Senior Audit Officer', null, '#0488fb'],
  ['u_senior3', 'Anita Singh', 'anita.singh@auditms.in', 'senior', 'Senior Audit Officer', null, '#0f766e'],
  ['u_junior1', 'Amit Kumar', 'amit.kumar@auditms.in', 'junior', 'Junior Audit Officer', null, '#b45309'],
  ['u_junior2', 'Neha Gupta', 'neha.gupta@auditms.in', 'junior', 'Junior Audit Officer', null, '#ff3381'],
  ['u_junior3', 'Rohit Mishra', 'rohit.mishra@auditms.in', 'junior', 'Junior Audit Officer', null, '#70428a'],
  ['u_junior4', 'Kavita Singh', 'kavita.singh@auditms.in', 'junior', 'Junior Audit Officer', null, '#0084ff'],
  ['u_coord1', 'Sunita Devi', 'sunita.devi@auditms.in', 'coordinator', 'Department Coordinator', 'd_hfw', '#ff66a1'],
  ['u_coord2', 'Deepak Kumar', 'deepak.kumar@auditms.in', 'coordinator', 'Department Coordinator', 'd_bed', '#cc004e'],
  ['u_coord3', 'Ravi Prakash', 'ravi.prakash@auditms.in', 'coordinator', 'Department Coordinator', 'd_pwd', '#99003b']
]

const USER_NAME = Object.fromEntries(WORKSPACE_USERS.map((u) => [u[0], u[1]]))

// ---------------------------------------------------------------- departments
const DEPARTMENTS = [
  ['d_fin', 'FIN', 'Finance Department', 'Sanjay Gupta', 'Director (Finance)', 186000000000, 4120,
    [['Directorate of Treasuries', 'R.L. Verma', 1860], ['Directorate of Stamps & Registration', 'M.K. Jain', 940], ['Budget Bureau', 'Anita Joshi', 210]]],
  ['d_hfw', 'HFW', 'Health & Family Welfare', 'Dr. S.K. Shukla', 'Director (Health)', 38500000000, 68400,
    [['Directorate of Medical Health', 'Dr. R.K. Singh', 12400], ['Directorate of Family Welfare', 'Dr. Vimla Srivastava', 3600], ['State Health Society', 'Dr. Pankaj Kumar', 2100]]],
  ['d_bed', 'BED', 'Basic Education', 'Deepak Kumar', 'Director (Basic Education)', 56200000000, 79200,
    [['Directorate of Basic Education', 'Pratap Singh', 14800], ['Mid-Day Meal Authority', 'Renu Bala', 620], ['Learning Mission', 'Ved Prakash', 1850]]],
  ['d_pwd', 'PWD', 'Public Works Department', 'Anil Kumar Yadav', 'Engineer-in-Chief', 28900000000, 21400,
    [['Roads & Bridges Wing', 'S.K. Tiwari', 8400], ['Buildings Wing', 'R.D. Singh', 5200], ['Design & Planning Cell', 'Manoj Verma', 410]]],
  ['d_rev', 'REV', 'Revenue', 'Sudhir Bobade', 'Revenue Board Chair', 3400000000, 28600,
    [['Directorate of Land Records', 'R.K. Pandey', 1900], ['Directorate of Consolidation', 'S.P. Singh', 2600], ['Stamps & Registration', 'M.K. Jain', 3400]]],
  ['d_agr', 'AGR', 'Agriculture', 'Manoj Kumar Singh', 'Director (Agriculture)', 19700000000, 15400,
    [['Directorate of Agriculture', 'A.K. Saini', 6800], ['Directorate of Horticulture', 'R.S. Tomar', 3200], ['Mandi Parishad', 'J.P. Yadav', 2900]]],
  ['d_rdd', 'RDD', 'Rural Development', 'L. Venkatesh', 'Director (Rural Development)', 42300000000, 32800,
    [['MGNREGA Cell', 'Alok Kumar', 9800], ['Directorate of Panchayati Raj', 'Sunita Verma', 6200], ['Rural Roads Division', 'M.K. Shukla', 7400]]],
  ['d_swf', 'SWF', 'Social Welfare', 'Kavita Ram', 'Director (Social Welfare)', 18400000000, 9800,
    [['Scholarship Cell', 'Ramesh Chandra', 640], ['Pension Directorate', 'Usha Rani', 880], ['Hostel Administration', 'Dinesh Yadav', 310]]],
  ['d_urb', 'URB', 'Urban Development', 'Prakash Chandra', 'Director (Urban Development)', 26700000000, 18900,
    [['Water Supply Division', 'S.K. Jain', 2400], ['Swachh Bharat Cell', 'Neelam Singh', 410], ['Town Planning Wing', 'Arvind Kumar', 760]]],
  ['d_pol', 'POL', 'Police', 'Bhanu Pratap Singh', 'Director General', 22600000000, 124000,
    [['CCTNS Cell', 'Vijay Sen, ADGP', 120], ['Modernisation Wing', 'R.K. Rathore, IG', 85], ['Wireless Wing', 'S.P. Yadav, SP', 210]]],
  ['d_irr', 'IRR', 'Irrigation & Water Resources', 'T. Damor', 'Engineer-in-Chief', 19800000000, 24700,
    [['Canal Wing', 'R.D. Verma', 8600], ['Drainage Wing', 'S.K. Singh', 5200], ['Flood Control Division', 'Anil Pandey', 4100]]],
  ['d_sbm', 'SBM', 'Skill Development', 'Anand Kumar', 'Director (Skill Development)', 6800000000, 4200,
    [['ITI Administration', 'R.P. Singh, 1340' , 1340], ['Apprenticeship Cell', 'Mohan Verma', 210], ['Exam Cell', 'Rekha Joshi', 180]]]
]
const DEPT_NAME = Object.fromEntries(DEPARTMENTS.map((d) => [d[0], d[2]]))

// ---------------------------------------------------------------- checklist templates (library, editable)
const CHECKLIST_TEMPLATES = {
  Financial: [
    ['Budget & Allocation', 'Verify budget provision against sanctioned expenditure'],
    ['Budget & Allocation', 'Check re-appropriation approvals and limits'],
    ['Budget & Allocation', 'Review drawdown pattern against quarterly targets'],
    ['Expenditure Verification', 'Vouch sampled vouchers with supporting documents'],
    ['Expenditure Verification', 'Reconcile DDO expenditure with treasury records'],
    ['Expenditure Verification', 'Check for round-sum and repetitive drawals'],
    ['Expenditure Verification', 'Verify advances and their timely adjustment'],
    ['Utilisation & Reporting', 'Verify utilisation certificates for grants-in-aid'],
    ['Utilisation & Reporting', 'Reconcile departmental books with treasury figures'],
    ['Assets & Stores', 'Verify stock registers and physical verification reports'],
    ['Assets & Stores', 'Check capitalisation of asset entries']
  ],
  Performance: [
    ['Planning & Targets', 'Review scheme objectives and approved targets'],
    ['Planning & Targets', 'Verify baseline data used for target setting'],
    ['Implementation', 'Assess coverage against eligible beneficiary list'],
    ['Implementation', 'Verify fund flow and release timelines'],
    ['Implementation', 'Review infrastructural works against approved designs'],
    ['Outcomes', 'Evaluate achievement of key performance indicators'],
    ['Outcomes', 'Conduct beneficiary verification survey'],
    ['Outcomes', 'Assess convergence with related schemes'],
    ['Reporting', 'Verify monthly progress reports with source data']
  ],
  Compliance: [
    ['Legal Framework', 'Identify applicable Acts, Rules and Financial Rule provisions'],
    ['Legal Framework', 'Verify compliance with Procurement Rules 2020'],
    ['Process Compliance', 'Test tendering process for prescribed thresholds'],
    ['Process Compliance', 'Verify approval hierarchy for expenditures'],
    ['Process Compliance', 'Check maintenance of statutory registers'],
    ['Process Compliance', 'Verify recovery and deposit of dues'],
    ['Reporting', 'Verify timely submission of prescribed returns'],
    ['Reporting', 'Review follow-up on previous audit observations']
  ],
  IT: [
    ['Access Control', 'Review user provisioning and de-provisioning process'],
    ['Access Control', 'Test password policy enforcement'],
    ['Access Control', 'Review privileged account usage and reviews'],
    ['Audit Trail', 'Verify system audit logging coverage'],
    ['Audit Trail', 'Test log integrity and retention configuration'],
    ['Data Security', 'Review database encryption at rest'],
    ['Data Security', 'Verify backup and restoration procedures'],
    ['Data Security', 'Assess vulnerability assessment report actions'],
    ['Availability', 'Review uptime and DR drill records']
  ],
  Forensic: [
    ['Background', 'Understand allegation and scope of investigation'],
    ['Background', 'Identify persons of interest and reporting lines'],
    ['Evidence', 'Preserve and hash digital evidence'],
    ['Evidence', 'Examine transaction trails and bank statements'],
    ['Evidence', 'Conduct third-party confirmations'],
    ['Evidence', 'Verify vendor credentials and addresses'],
    ['Analysis', 'Perform funds tracing and layering analysis'],
    ['Analysis', 'Quantify financial impact'],
    ['Reporting', 'Prepare findings with evidentiary references']
  ]
}

function buildChecklistTemplateLibrary() {
  const names = {
    Financial: 'Financial Audit - Standard Checklist',
    Performance: 'Performance Audit - Standard Checklist',
    Compliance: 'Compliance Audit - Standard Checklist',
    IT: 'IT Audit - Standard Checklist',
    Forensic: 'Forensic Audit - Standard Checklist'
  }
  return Object.entries(CHECKLIST_TEMPLATES).map(([type, items], i) => ({
    id: `ctpl_${i + 1}`,
    name: names[type],
    type,
    description: `Standard ${type.toLowerCase()} audit procedure covering ${items.length} verification items across ${new Set(items.map((x) => x[0])).size} areas.`,
    items: items.map(([category, item]) => ({ category, item })),
    createdBy: 'Rajesh Kumar Singh',
    createdAt: ago(240),
    system: true
  }))
}

// ---------------------------------------------------------------- audit specs
// [id, seq, type, dept, title, status, priority, startOffsetDays, durationDays, lead, team, budgetLakh, risk, progressOverride]
const AUDIT_SPECS = [
  ['a1', 1, 'Financial', 'd_hfw', `Financial Audit of Health & Family Welfare - FY ${prevFy} Expenditure`, 'In Progress', 'High', -24, 45, 'u_senior1', ['u_senior2', 'u_junior1', 'u_junior2'], 8.5, 72, null],
  ['a2', 2, 'Performance', 'd_bed', 'Performance Audit of Mid-Day Meal Scheme - Coverage, Quality & Fund Flow', 'In Progress', 'High', -18, 60, 'u_senior2', ['u_junior2', 'u_junior3'], 11.2, 66, null],
  ['a3', 3, 'Compliance', 'd_pwd', 'Compliance Audit of Tendering & Procurement for Road Works', 'In Progress', 'Critical', -30, 50, 'u_senior1', ['u_junior1', 'u_junior4', 'u_senior3'], 9.8, 84, null],
  ['a4', 4, 'IT', 'd_pol', 'IT Audit of CCTNS Platform and e-FIR System - Access & Audit Trails', 'In Progress', 'High', -12, 40, 'u_senior3', ['u_junior3'], 7.4, 61, null],
  ['a5', 5, 'Forensic', 'd_swf', 'Forensic Audit of Post-Matric Scholarship Disbursement - Fraud Allegation', 'In Progress', 'Critical', -40, 70, 'u_senior2', ['u_junior1', 'u_junior4'], 15.6, 91, null],
  ['a6', 6, 'Financial', 'd_rdd', `Financial Audit of MGNREGA Expenditure - FY ${prevFy}`, 'Planned', 'High', 35, 55, 'u_senior3', [], 12.0, 68, 0],
  ['a7', 7, 'Performance', 'd_swf', 'Performance Audit of Kanya Sumangala Scheme - Beneficiary Outcomes', 'Completed', 'Medium', -95, 60, 'u_senior3', ['u_junior4'], 9.0, 44, 100],
  ['a8', 8, 'Compliance', 'd_rev', 'Compliance Audit of Land Records Digitisation & Mutation Disposal', 'In Progress', 'Medium', -15, 45, 'u_senior1', ['u_junior2'], 6.8, 52, null],
  ['a9', 9, 'IT', 'd_fin', 'IT Audit of Kosh Treasury System - Security & Data Integrity', 'Scheduled', 'High', 12, 40, 'u_senior3', ['u_junior1'], 8.8, 74, 0],
  ['a10', 10, 'Financial', 'd_agr', `Financial Audit of Agriculture Subsidy Disbursement - FY ${prevFy}`, 'Planned', 'Medium', 48, 50, 'u_senior2', [], 10.5, 55, 0],
  ['a11', 11, 'Performance', 'd_urb', 'Performance Audit of AMRUT Water Supply Works', 'Planned', 'Medium', 60, 60, null, [], 11.0, 49, 0],
  ['a12', 12, 'Compliance', 'd_irr', 'Compliance Audit of Contractor Payments & Bank Guarantees', 'Under Review', 'High', -70, 50, 'u_senior1', ['u_junior3'], 7.9, 70, 100],
  ['a13', 13, 'Forensic', 'd_irr', 'Forensic Audit of Irrigation Contractor Payments - Shell Vendor Allegation', 'Planned', 'High', 75, 80, null, [], 18.0, 88, 0],
  ['a14', 14, 'IT', 'd_hfw', 'IT Audit of e-Hospital & HMIS Deployment - Data Protection', 'Planned', 'Low', 90, 35, null, [], 6.2, 38, 0],
  ['a15', 15, 'Performance', 'd_urb', 'Performance Audit of Swachh Bharat Mission (Urban)', 'Completed', 'Medium', -120, 65, 'u_senior2', ['u_junior4'], 9.4, 42, 100],
  ['a16', 16, 'Compliance', 'd_pol', 'Compliance Audit of Police Modernisation Fund Utilisation', 'Closed', 'Low', -170, 45, 'u_senior3', ['u_junior2'], 5.5, 30, 100],
  ['a17', 17, 'Financial', 'd_rev', `Financial Audit of Stamp & Registration Receipts - FY ${prevFy}`, 'Scheduled', 'Medium', 20, 40, 'u_senior1', ['u_junior4'], 7.2, 47, 0]
]

const TYPE_PREFIX = { Financial: 'FA', Performance: 'PA', Compliance: 'CA', IT: 'IA', Forensic: 'FoA' }

function buildChecklist(type, progress, auditId, rnd) {
  const items = CHECKLIST_TEMPLATES[type] || []
  let i = 0
  return items.map(([category, item]) => {
    i += 1
    const r = rnd()
    let status = 'Pending'
    if (progress >= 100) status = r > 0.92 ? 'N/A' : 'Completed'
    else if (progress > 0) status = r < progress / 130 ? 'Completed' : r < progress / 90 ? 'In Progress' : 'Pending'
    const done = status === 'Completed'
    return {
      id: `${auditId}_c${i}`,
      category,
      item,
      status,
      notes: done && r > 0.5 ? 'Verified against records produced by the department.' : '',
      completedBy: done ? USER_NAME[['u_junior1', 'u_junior2', 'u_junior3', 'u_junior4'][Math.floor(rnd() * 4)]] : null,
      completedAt: done ? ago(Math.floor(rnd() * 20) + 1) : null
    }
  })
}

function buildWorkpapers(auditId, progress, lead, team, rnd) {
  const defs = [
    ['WP-A', 'Audit programme & team allocation'],
    ['WP-B', 'Opening conference minutes'],
    ['WP-C', 'Sampling plan & sample list'],
    ['WP-D', 'Voucher testing sheet'],
    ['WP-E', 'Departmental replies & reconciliations'],
    ['WP-F', 'Summary of findings & closing conference']
  ]
  const n = progress >= 100 ? 6 : progress > 60 ? 5 : progress > 30 ? 3 : progress > 0 ? 2 : 1
  return defs.slice(0, n).map((d, i) => {
    const status = progress >= 100 ? 'Approved' : i < n - 1 ? (rnd() > 0.3 ? 'Reviewed' : 'Approved') : progress > 0 ? 'Submitted' : 'Draft'
    const preparedBy = USER_NAME[team[i % Math.max(team.length, 1)]] || USER_NAME[lead] || 'Team'
    return {
      id: `${auditId}_wp${i + 1}`,
      ref: `${d[0]}-${String(i + 1).padStart(2, '0')}`,
      title: d[1],
      preparedBy,
      status,
      reviewedBy: status === 'Reviewed' || status === 'Approved' ? 'Rajesh Kumar Singh (CAO)' : null,
      date: ago(Math.max(2, 40 - i * 6)),
      remarks: status === 'Approved' ? 'Documentation complete and verified.' : ''
    }
  })
}

const OBJECTIVES = {
  Financial: `Verify the correctness of expenditure, adherence to budget provisions, and proper adjustment of advances for the year ${prevFy}.`,
  Performance: 'Evaluate whether the scheme achieved its intended objectives economically, efficiently and effectively, and identify causes of shortfall.',
  Compliance: 'Examine compliance with applicable Acts, Rules, Financial Rule provisions and departmental orders governing procurement and payments.',
  IT: 'Assess access controls, audit trails, data security and availability controls of the system under review.',
  Forensic: 'Investigate the alleged irregularity, establish the money trail, quantify the financial impact and identify responsible persons.'
}
const SCOPES = {
  Financial: `Expenditure registers, vouchers, treasury reconciliations, utilisation certificates and advance ledgers for FY ${prevFy}. Sample of 25 DDOs across 5 districts.`,
  Performance: 'Scheme coverage, fund flow, beneficiary lists, physical infrastructure and outcome indicators across a sample of 6 districts.',
  Compliance: 'Tender files, approval memos, statutory registers and payment records for transactions during the review period.',
  IT: 'System configuration, user management, logs, backup records and DR drill reports; interviews with IT administrators.',
  Forensic: 'Bank statements, vendor records, beneficiary databases, IP logs and physical verification of addresses.'
}

const EVIDENCE_DEFS = [
  'Voucher bundle (scanned, 40 pages)', 'Treasury reconciliation statement', 'Beneficiary sample list (Excel)',
  'Tender file - work order copy', 'Bank statement extract', 'Stock register extract',
  'Minutes of entry conference', 'Departmental reply on draft observations'
]

function buildEvidence(auditId, progress, team, rnd) {
  const n = progress >= 100 ? 5 : progress > 60 ? 4 : progress > 30 ? 3 : progress > 0 ? 2 : 0
  return EVIDENCE_DEFS.slice(0, n).map((name, i) => ({
    id: `${auditId}_ev${i + 1}`,
    name,
    type: 'text/plain',
    size: 4200 + Math.floor(rnd() * 90000),
    uploadedBy: USER_NAME[(team[i % Math.max(team.length, 1)]) || 'u_junior1'] || 'Audit team',
    uploadedAt: ago(Math.max(1, 40 - i * 7)),
    description: `Collected during field work. Covers ${name.toLowerCase().includes('voucher') ? 'sampled vouchers for the review period' : 'the review period as per audit programme'}. Source verified with the departmental records branch.`,
    fileId: `${auditId}_evf${i + 1}`
  }))
}

function buildAudits() {
  return AUDIT_SPECS.map((s) => {
    const [id, seq, type, dept, title, status, priority, startOff, dur, lead, team, budgetLakh, risk] = s
    const rnd = seededRandom(id + title)
    const start = inDays(startOff)
    const end = inDays(startOff + dur)
    let progress = 0
    if (status === 'In Progress') progress = clamp(30 + Math.floor(rnd() * 45), 30, 80)
    if (status === 'Under Review') progress = 95 + Math.floor(rnd() * 5)
    if (status === 'Completed' || status === 'Closed') progress = 100
    const teamRoles = ['Auditor', 'Auditor', 'Subject Expert']
    const teamMembers = team.map((uid_, i) => ({ userId: uid_, name: USER_NAME[uid_], role: i === 0 ? 'Co-lead' : teamRoles[i % 3] }))
    const timeline = [
      { date: inDays(startOff - 21), event: 'Audit entry created in the annual plan' },
      { date: inDays(startOff - 14), event: lead ? `Team assigned - lead: ${USER_NAME[lead]}` : 'Team assignment pending' }
    ]
    if (progress > 0) timeline.push({ date: start, event: 'Field work commenced' })
    if (progress >= 40) timeline.push({ date: inDays(startOff + Math.floor(dur / 2)), event: 'Interim review held with department coordinator' })
    if (progress >= 100) timeline.push({ date: end, event: 'Field work completed' })
    const reviewHistory = []
    if (status === 'Under Review' || status === 'Completed' || status === 'Closed') {
      reviewHistory.push({ action: 'Submitted for review', by: lead ? USER_NAME[lead] : 'Team', date: end, notes: 'Audit documentation complete, findings draft attached.' })
    }
    if (status === 'Completed' || status === 'Closed') {
      reviewHistory.push({ action: 'Approved by Chief Audit Officer', by: 'Rajesh Kumar Singh (CAO)', date: inDays(startOff + dur + 5), notes: 'Approved with minor editorial comments on finding wording.' })
    }
    if (status === 'Closed') {
      reviewHistory.push({ action: 'Finalised & issued to department', by: 'Dr. Meena Sharma (Director)', date: inDays(startOff + dur + 18), notes: 'Final report issued; compliance tracking active.' })
    }
    const comments = []
    if (status === 'In Progress' && team.length) {
      comments.push(
        { id: `${id}_cm1`, userId: lead, userName: USER_NAME[lead], text: 'Opening conference done. The department has shared the first batch of records. Please start with the sampling plan.', timestamp: ago(9, 11, 15) },
        { id: `${id}_cm2`, userId: team[0], userName: USER_NAME[team[0]], text: 'Received voucher registers for two districts. Cross-checking with treasury figures now.', timestamp: ago(6, 15, 40) }
      )
      if (team[1]) comments.push({ id: `${id}_cm3`, userId: team[1], userName: USER_NAME[team[1]], text: 'Two vendors are not traceable at the given addresses - flagging for physical verification next week.', timestamp: ago(3, 10, 5) })
    }
    return {
      id,
      code: `${TYPE_PREFIX[type]}-${fyStart}-${String(seq).padStart(3, '0')}`,
      title,
      type,
      departmentId: dept,
      departmentName: DEPT_NAME[dept],
      fiscalYear: fy,
      status,
      priority,
      startDate: start,
      endDate: end,
      auditPeriod: type === 'Financial' ? `April ${fyStart - 1} - March ${fyStart}` : 'As per audit programme',
      leadAuditorId: lead,
      leadAuditorName: lead ? USER_NAME[lead] : null,
      team: teamMembers,
      allocatedBudget: budgetLakh * 100000,
      estimatedDays: dur,
      objectives: OBJECTIVES[type],
      scope: SCOPES[type],
      riskScore: risk,
      progress,
      checklist: buildChecklist(type, progress, id, rnd),
      evidence: buildEvidence(id, progress, team, rnd),
      workpapers: buildWorkpapers(id, progress, lead, team, rnd),
      comments,
      reviewHistory,
      timeline,
      createdAt: inDays(startOff - 21)
    }
  })
}

// ---------------------------------------------------------------- findings
const FINDING_SPECS = [
  // [id, audit, title, category, severity, status, amountLakh, daysAgo, dueInDays, description]
  ['f01', 'a3', 'Payment of ₹86.50 lakh released without measurement book verification', 'Procurement', 'Critical', 'Action Planned', 86.5, 14, -6, 'Running account bill of ₹86.50 lakh (Shree Balaji Constructions) was paid without the assistant engineer countersigning the measurement book, violating Works Code para 3.12.'],
  ['f02', 'a3', 'Single-bidder tenders accepted in 12 of 45 sampled road works', 'Procurement', 'High', 'Under Review', 0, 20, 8, 'In 12 of 45 sampled works the tender was finalised with only one responsive bid, without the mandatory justification memo required under Procurement Rules 2020.'],
  ['f03', 'a3', 'Tender finalisation delayed 63-147 days against prescribed 60 days', 'Compliance', 'Medium', 'Open', 0, 18, 15, 'Average tender-to-award time in the sample was 96 days against the prescribed ceiling of 60 days, delaying work commencement across the district.'],
  ['f04', 'a5', 'Duplicate scholarship disbursement to 214 students across two districts', 'Fraud', 'Critical', 'Under Review', 42.8, 25, 4, 'DBT trail shows 214 student IDs receiving the post-matric scholarship twice in the same quarter through different institute codes, indicating duplicate beneficiary records or identity misuse.'],
  ['f05', 'a5', '14% of sampled beneficiaries not traceable in institute admission records', 'Fraud', 'High', 'Open', 0, 12, 20, 'Physical verification of 350 sampled beneficiaries could not establish admission for 49 students; institutes concerned have been asked to produce original records.'],
  ['f06', 'a1', 'Unspent balance of ₹12.3 crore not surrendered before financial year close', 'Financial Irregularity', 'High', 'Under Review', 1230, 22, -2, 'Seven chief medical offices carried forward unspent balances into the new year without revalidation or surrender, contrary to Financial Rules Rule 63.'],
  ['f07', 'a1', 'Payments to medicine suppliers without mandatory quality testing reports', 'Compliance', 'High', 'Open', 0, 10, 18, 'Payment of ₹3.2 crore was released against supply orders where the drug testing lab report was absent from the file.'],
  ['f08', 'a2', 'Food grain stock registers not reconciled for two consecutive quarters', 'Compliance', 'Medium', 'Action Planned', 0, 15, 10, 'District-level stock registers of food grain could not be reconciled with FCI receipts for two quarters, obscuring 4,200 quintals of grain movement.'],
  ['f09', 'a2', 'Cook-cum-helper honorarium delayed beyond three months in six districts', 'Performance', 'Medium', 'Open', 0, 9, 25, 'Honorarium to 8,400 cook-cum-helpers was pending for over three months, against the guideline norm of monthly payment.'],
  ['f10', 'a8', 'Mutation requests pending beyond the 90-day limit in four tehsils', 'Compliance', 'High', 'Open', 0, 11, 12, '2,318 mutation applications were found pending beyond the 90-day disposal limit under the Revenue Code 2006.'],
  ['f11', 'a8', 'Digital signature certificates expired for 23 revenue officers', 'IT Security', 'Low', 'Resolved', 0, 30, -10, 'Expired DSCs allowed manual insertion of records, weakening the integrity guarantee of land records digitisation. Certificates have since been renewed.'],
  ['f12', 'a4', 'CCTNS user accounts shared across operators at nine police stations', 'IT Security', 'Critical', 'Open', 0, 8, 14, 'The same operator credentials were used by multiple persons at nine police stations, defeating individual accountability in the e-FIR workflow.'],
  ['f13', 'a4', 'Audit trail disabled on the e-FIR module for four months', 'IT Security', 'High', 'Under Review', 0, 7, 9, 'System configuration shows the audit trail flag was switched off between March and June, coinciding with the disposal of 41 FIRs.'],
  ['f14', 'a12', 'Running account bills paid without recovery of mobilisation advance', 'Financial Irregularity', 'High', 'Under Review', 310, 35, -8, 'Recoveries of mobilisation advance were not adjusted in eleven running account bills, leaving ₹3.10 crore outstanding beyond the contractual recovery schedule.'],
  ['f15', 'a12', 'Bank guarantees expired before work completion in seven contracts', 'Compliance', 'Medium', 'Action Planned', 0, 28, 5, 'Performance bank guarantees had lapsed for seven ongoing contracts worth ₹41 crore, exposing the department to unsecured risk.'],
  ['f16', 'a15', 'Community toilets non-functional for want of water connections', 'Performance', 'Medium', 'Resolved', 0, 70, -30, '32 of 80 sampled community toilets were locked or unused because water connections were never commissioned; the ULB has since completed connections.'],
  ['f17', 'a15', 'Operation and maintenance fund utilised for new construction', 'Financial Irregularity', 'Medium', 'Closed', 0, 65, -40, 'O&M grants were used to build new toilet blocks, contrary to the sanctioned purpose; matter taken up with the ULB and regularised with approval.'],
  ['f18', 'a7', 'Installment disbursement delayed by 6-9 months to beneficiaries', 'Performance', 'Medium', 'Resolved', 0, 60, -25, 'The second and third installments reached beneficiaries 6-9 months late due to batch-processing gaps at the district level.'],
  ['f19', 'a7', 'Aadhaar seeding pending for 18% of beneficiaries', 'Compliance', 'High', 'Resolved', 0, 58, -20, 'Payment failures were traced to pending Aadhaar seeding; special camps resolved 89% of the pending cases.'],
  ['f20', 'a16', 'Modernisation vehicles procured but GPS units not installed', 'Compliance', 'Low', 'Closed', 0, 150, -60, 'GPS units supplied for the modernisation vehicle fleet were lying uninstalled in stores; subsequently installed and verified.'],
  ['f21', 'a1', 'Advance of ₹2.10 crore pending adjustment over 18 months with CMOs', 'Financial Irregularity', 'Medium', 'Open', 210, 6, 22, 'Advances drawn for medical camps were never adjusted or returned, pending for more than the permitted three months under Financial Rules Rule 237.'],
  ['f22', 'a5', 'Vendor shell company shares registered address with departmental supplier', 'Fraud', 'Critical', 'Under Review', 0, 16, 2, 'The printing vendor who supplied institute booklets shares its registered address and director PAN with an empanelled supplier of the department, indicating related-party bidding.']
]

function buildFindings() {
  return FINDING_SPECS.map((s) => {
    const [id, auditId, title, category, severity, status, amountLakh, daysAgo, dueIn, description] = s
    const responses = []
    const audit = AUDIT_SPECS.find((a) => a[0] === auditId)
    const dept = audit ? audit[3] : null
    const raisedBy = audit && audit[9] ? audit[9] : 'u_senior1'
    if (status === 'Action Planned' || status === 'Under Review' || status === 'Resolved') {
      responses.push({
        by: dept === 'd_hfw' ? 'Sunita Devi (Department Coordinator)' : 'Department Coordinator',
        role: 'coordinator',
        type: 'Response',
        text: 'Department acknowledges the observation. A compliance certificate and detailed action taken note has been submitted to the audit team.',
        date: ago(Math.max(1, daysAgo - 5))
      })
    }
    return {
      id,
      auditId,
      auditCode: '',
      departmentId: dept,
      title,
      category,
      severity,
      status,
      amountInvolved: amountLakh * 100000,
      description,
      raisedBy,
      raisedByName: USER_NAME[raisedBy] || 'Priya Yadav',
      raisedDate: ago(daysAgo),
      dueDate: inDays(dueIn),
      responses
    }
  })
}

// ---------------------------------------------------------------- observations (compliance tracking)
const OBS_SPECS = [
  // [id, finding?, audit, title, requirement, status(compliance), tracking status, dueInDays, escalation, reminders]
  ['o01', 'f01', 'a3', 'Open tendering for works above ₹10 lakh', 'Financial Rules 2017 Rule 149 / Procurement Rules 2020', 'Non-Compliant', 'Escalated', -5, 2, 3],
  ['o02', 'f06', 'a1', 'Surrender of unspent balances before FY close', 'Financial Rules 2017 Rule 63', 'Partially Compliant', 'In Progress', 7, 0, 1],
  ['o03', 'f04', 'a5', 'DBT uniqueness verification for scholarships', 'Scholarship Rules + DBT guidelines', 'Non-Compliant', 'Open', 3, 1, 2],
  ['o04', 'f08', 'a2', 'Monthly stock reconciliation of food grain', 'MDM Guidelines 2020, para 6.4', 'Partially Compliant', 'In Progress', 12, 0, 1],
  ['o05', null, 'a8', 'Records retention and digitisation standards', 'Records Manual 2021', 'Compliant', 'Resolved', -15, 0, 0],
  ['o06', 'f12', 'a4', 'Individual user accounts and access control', 'IT security guidelines', 'Non-Compliant', 'Open', 9, 0, 1],
  ['o07', 'f15', 'a12', 'Validity of performance bank guarantees', 'Works Code para 3.42', 'Partially Compliant', 'In Progress', -3, 1, 2],
  ['o08', null, 'a15', 'Geo-tagging of assets created under SBM', 'SBM (Urban) guidelines 2017', 'Compliant', 'Resolved', -35, 0, 0],
  ['o09', 'f19', 'a7', 'Aadhaar seeding for DBT beneficiaries', 'DBT guidelines 2020', 'Partially Compliant', 'Escalated', -1, 1, 2],
  ['o10', null, 'a1', 'Physical verification of stores and equipment', 'Financial Rules 2017 Rule 213', 'Pending', 'Open', 18, 0, 0],
  ['o11', 'f09', 'a2', 'Timely honorarium payment to cook-cum-helpers', 'MDM Guidelines 2020', 'Partially Compliant', 'In Progress', 20, 0, 1],
  ['o12', 'f10', 'a8', 'Mutation disposal within 90 days', 'Revenue Code 2006, section 33', 'Non-Compliant', 'In Progress', 6, 0, 1],
  ['o13', 'f20', 'a16', 'GPS installation in modernisation vehicles', 'Modernisation guidelines', 'Compliant', 'Resolved', -55, 0, 0],
  ['o14', 'f21', 'a1', 'Adjustment of advances within three months', 'Financial Rules 2017 Rule 237', 'Non-Compliant', 'Open', 11, 0, 1],
  ['o15', 'f07', 'a1', 'Quality testing before payment for medicines', 'Drugs & Cosmetics Rules 1945', 'Non-Compliant', 'Open', 15, 0, 0],
  ['o16', null, 'a3', 'e-Office file processing for tender records', 'e-Office mandate 2023', 'Pending', 'Open', 25, 0, 0]
]

function buildObservations() {
  return OBS_SPECS.map((s) => {
    const [id, findingId, auditId, title, requirement, complianceStatus, status, dueIn, escalation, reminders] = s
    const audit = AUDIT_SPECS.find((a) => a[0] === auditId)
    return {
      id,
      findingId,
      auditId,
      title,
      requirement,
      departmentId: audit ? audit[3] : null,
      complianceStatus,
      status,
      dueDate: inDays(dueIn),
      followUpDate: status === 'Resolved' ? inDays(dueIn + 10) : inDays(Math.max(3, dueIn + 7)),
      escalationLevel: escalation,
      escalatedTo: escalation >= 2 ? 'Head of Department' : escalation === 1 ? 'Department Director' : null,
      escalatedAt: escalation ? inDays(dueIn + 5) : null,
      escalationRemarks: escalation ? 'Compliance overdue despite repeated reminders; escalated for intervention.' : '',
      remindersSent: reminders,
      resolvedAt: status === 'Resolved' ? inDays(dueIn + 5) : null,
      resolutionNote: status === 'Resolved' ? 'Compliance certificate verified by audit team; observation closed.' : '',
      history: [
        { date: inDays(dueIn - 30), event: 'Observation raised from audit finding review' },
        ...(reminders ? [{ date: inDays(dueIn + 3), event: `${reminders} reminder(s) sent to department coordinator` }] : []),
        ...(escalation ? [{ date: inDays(dueIn + 5), event: `Escalated to level ${escalation} (${escalation >= 2 ? 'Head of Department' : 'Department Director'})` }] : [])
      ]
    }
  })
}

// ---------------------------------------------------------------- transactions (anomaly screening feed)
const VENDORS = [
  'Shree Balaji Constructions', 'Jai Bharat Traders', 'Digital India Solutions Pvt Ltd',
  'Ganga Infra Works', 'Ramesh Kumar & Sons', 'UP Medical Supplies Corp',
  'Saraswati Printing Press', 'Bhartiya Security Systems', 'Vikas Electricals',
  'Krishna Agro Services', 'Om Sai Computers', 'Chandra Motors Ltd',
  'Gupta & Associates (CA)', 'Aditya Stationers'
]

function buildTransactions() {
  const rnd = seededRandom('txn-seed-v1')
  const txns = []
  const descByDept = {
    d_hfw: ['Medicine supply payment', 'Hospital equipment purchase', 'NHM program expense', 'Ambulance fuel & maintenance'],
    d_bed: ['MDM food grain payment', 'School furniture supply', 'Textbook printing', 'Teacher training expense'],
    d_pwd: ['Road work running bill', 'Bridge maintenance', 'Building repair payment', 'Consultancy fee'],
    d_pol: ['Vehicle fuel & repairs', 'Wireless equipment purchase', 'Uniform supply', 'Police station renovation'],
    d_swf: ['Scholarship DBT batch', 'Printing of beneficiary cards', 'Awareness camp expense', 'Pension disbursement batch'],
    d_irr: ['Canal repair payment', 'Pump machinery purchase', 'Flood control works', 'Survey expense'],
    d_rdd: ['MGNREGA wage batch', 'Material payment', 'Village road work', 'Gram panchayat grant release'],
    d_urb: ['Street lighting maintenance', 'Water supply works', 'Solid waste management', 'Town planning survey'],
    d_rev: ['Software licence renewal', 'Records digitisation', 'Office equipment', 'Survey expense'],
    d_agr: ['Seed subsidy payment', 'Equipment purchase', 'Training expense', 'Crop survey expense'],
    d_fin: ['Treasury software AMC', 'Office infrastructure', 'Consultancy fee', 'Printing & stationery'],
    d_sbm: ['Lab equipment purchase', 'Furniture supply', 'Exam printing expense', 'IT infrastructure']
  }
  const depts = Object.keys(descByDept)
  let n = 1
  const push = (dept, vendor, amount, daysAgo, desc, weekday) => {
    let date = ago(daysAgo, 12, 15)
    if (weekday !== undefined) {
      const d = new Date(date)
      d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7 || 7) % 7)
      date = d.toISOString()
    }
    txns.push({
      id: `t_${String(n).padStart(3, '0')}`,
      departmentId: dept,
      refNo: `PFMS/UP/${fyStart}/${String(10000 + n)}`,
      vendor,
      description: desc,
      amount,
      mode: ['PFMS', 'PFMS', 'RTGS', 'NEFT'][n % 4],
      date,
      source: 'PFMS feed',
      anomalyReview: { status: 'Pending review', by: null, date: null, note: '' }
    })
    n += 1
  }

  // organic transactions
  for (let i = 0; i < 76; i++) {
    const dept = depts[Math.floor(rnd() * depts.length)]
    const vendor = VENDORS[Math.floor(rnd() * VENDORS.length)]
    const descs = descByDept[dept]
    let amount = Math.round((300000 + rnd() * 6500000) / 1000) * 1000
    if (amount % 100000 === 0) amount += 37000
    push(dept, vendor, amount, Math.floor(rnd() * 110) + 1, descs[Math.floor(rnd() * descs.length)])
  }
  // injected anomalies
  push('d_pwd', 'Shree Balaji Constructions', 4750000, 45, 'Road work running bill - phase 2')
  push('d_pwd', 'Shree Balaji Constructions', 4750000, 43, 'Road work running bill - phase 2 (repeat)')
  push('d_swf', 'Saraswati Printing Press', 480000, 20, 'Beneficiary booklet printing - lot 1')
  push('d_swf', 'Saraswati Printing Press', 460000, 16, 'Beneficiary booklet printing - lot 2')
  push('d_hfw', 'UP Medical Supplies Corp', 12000000, 12, 'Annual medicine supply advance', 0)
  push('d_irr', 'Ganga Infra Works', 25000000, 8, 'Canal work mobilisation advance')
  push('d_bed', 'Om Sai Computers', 3000000, 55, 'Computer lab setup - invoice 1')
  push('d_bed', 'Om Sai Computers', 3400000, 40, 'Computer lab setup - invoice 2')
  push('d_bed', 'Om Sai Computers', 2900000, 25, 'Smart classroom equipment')
  push('d_bed', 'Om Sai Computers', 3100000, 9, 'Tab supply for teachers')
  // pre-reviewed example
  txns[txns.length - 1].anomalyReview = { status: 'Rejected - false positive', by: 'Rajesh Kumar Singh', date: ago(2), note: 'Four supply orders under one annual rate contract; verified genuine.' }
  return txns
}

// ---------------------------------------------------------------- documents
const DOC_SPECS = [
  // [id, name, category, dept, owner, tags, versions, sharedUsers, kind]
  ['doc1', 'National Audit Manual 2024 - Chapter 4 (Working Papers)', 'Guideline', null, 'u_cao', ['manual', 'working papers'], 3, ['u_senior1', 'u_senior2'], 'pdf'],
  ['doc2', 'Financial Rules 2017 - Extract of Rules 63, 149, 213 & 237', 'Policy', null, 'u_cao', ['rules', 'reference'], 2, [], 'pdf'],
  ['doc3', 'Annual Audit Plan Framework & Risk Matrix Template', 'Template', null, 'u_cao', ['planning', 'risk'], 4, ['u_cao', 'u_director'], 'excel'],
  ['doc4', 'PFMS Reconciliation Procedure for Field Audits', 'Guideline', 'd_fin', 'u_admin', ['PFMS', 'reconciliation'], 5, ['u_senior1'], 'pdf'],
  ['doc5', 'Health & Family Welfare - FY utilisation certificates bundle', 'Report', 'd_hfw', 'u_coord1', ['UC', 'health'], 1, ['u_senior1', 'u_senior2'], 'pdf'],
  ['doc6', 'PWD - Tender files index (sampled 45 works)', 'Report', 'd_pwd', 'u_coord1', ['tender', 'PWD'], 1, ['u_senior1'], 'excel'],
  ['doc7', 'Circular: Physical verification of stores (FY cycle)', 'Circular', null, 'u_director', ['stores', 'verification'], 2, [], 'pdf'],
  ['doc8', 'IT Audit security baseline checklist', 'Guideline', null, 'u_senior3', ['IT audit', 'security'], 3, ['u_junior3'], 'pdf'],
  ['doc9', 'Scholarship DBT - duplicate beneficiary exception report', 'Report', 'd_swf', 'u_senior2', ['scholarship', 'DBT'], 1, ['u_cao', 'u_director'], 'pdf'],
  ['doc10', 'e-Hospital HMIS - DR drill record 2026', 'Report', 'd_hfw', 'u_coord1', ['DR', 'HMIS'], 1, ['u_senior3'], 'image'],
  ['doc11', 'Audit observation escalation matrix', 'Policy', null, 'u_cao', ['escalation', 'compliance'], 2, [], 'pdf'],
  ['doc12', 'Draft report - Compliance Audit of Irrigation Contractor Payments', 'Report', 'd_irr', 'u_senior1', ['draft report', 'irrigation'], 1, ['u_cao'], 'word']
]

const DOC_TYPE_MIME = { pdf: 'application/pdf', image: 'image/svg+xml', word: 'application/msword', excel: 'text/csv', text: 'text/plain' }
const DOC_TYPE_EXT = { pdf: 'pdf', image: 'svg', word: 'doc', excel: 'csv', text: 'txt' }

function docBody(name, kind, version) {
  const heading = `${name} (v${version})`
  if (kind === 'pdf') {
    return makePdf(name, [
      { heading: 'Overview' },
      { text: 'This document is part of the audit workspace repository. It is stored and versioned inside the platform and can be shared with audit teams with view or edit permission.' },
      { heading: 'Contents' },
      { text: '1. Reference and applicability' },
      { text: '2. Procedure / policy notes' },
      { text: '3. Records to be maintained' },
      { text: '4. Review and escalation notes' },
      { heading: 'Notes' },
      { text: `Version ${version} of this document. Latest revision available in the document repository.` }
    ], `Audit workspace - ${new Date().getFullYear()}`)
  }
  if (kind === 'image') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="#f3eef7"/>
  <rect x="30" y="30" width="580" height="60" rx="8" fill="#ba98cd"/>
  <text x="50" y="66" font-family="Arial" font-size="20" font-weight="bold" fill="#382145">DR Drill Record - e-Hospital HMIS</text>
  <rect x="30" y="110" width="280" height="120" rx="8" fill="#e6f3ff"/>
  <text x="50" y="140" font-family="Arial" font-size="13" fill="#023664">Primary site failover: SUCCESS</text>
  <text x="50" y="165" font-family="Arial" font-size="13" fill="#023664">RPO achieved: 4 minutes</text>
  <text x="50" y="190" font-family="Arial" font-size="13" fill="#023664">RTO achieved: 22 minutes</text>
  <rect x="330" y="110" width="280" height="120" rx="8" fill="#ffe5ef"/>
  <text x="350" y="140" font-family="Arial" font-size="13" fill="#660027">Backup integrity: VERIFIED</text>
  <text x="350" y="165" font-family="Arial" font-size="13" fill="#660027">Restore test: 1,240 records OK</text>
  <text x="350" y="190" font-family="Arial" font-size="13" fill="#660027">Log continuity: CONFIRMED</text>
  <rect x="30" y="250" width="580" height="120" rx="8" fill="#ffffff" stroke="#d1bade"/>
  <text x="50" y="285" font-family="Arial" font-size="13" fill="#382145">Drill conducted by IT Audit team with department administrators.</text>
  <text x="50" y="310" font-family="Arial" font-size="13" fill="#382145">Observations and sign-offs recorded in the drill report annexure.</text>
  <text x="50" y="335" font-family="Arial" font-size="12" fill="#70428a">Document version ${version}</text>
</svg>`
    return new Blob([svg], { type: 'image/svg+xml' })
  }
  if (kind === 'excel') {
    const rows = [
      'Item,Area,Owner,Status,Notes',
      'Annual plan coverage,Planning,CAO,Final,17 audits mapped to departments',
      'Risk matrix weights,Risk,Director,Final,Weights approved for FY cycle',
      'Resource calendar,Teams,CAO,In review,Officer workload balanced across quarters',
      'Department benchmarking,Analytics,Director,Draft,Pending Q2 data',
      `Document version,Repository,${'Owner'},v${version},Auto-note`
    ]
    return new Blob([rows.join('\n')], { type: 'text/csv' })
  }
  if (kind === 'word') {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><title>${name}</title></head>
<body><h1 style="font-family:Calibri,Arial;color:#382145">${name}</h1>
<p style="font-family:Calibri,Arial">Draft compliance audit report prepared from the audit workspace. This is version ${version}.</p>
<h2 style="font-family:Calibri,Arial;color:#543267">Summary</h2>
<p style="font-family:Calibri,Arial">Covers mobilisation advance recoveries and lapsed bank guarantees for contractor payments.</p></body></html>`
    return new Blob(['\ufeff' + html], { type: 'application/msword' })
  }
  const content = `${name}\n${'='.repeat(name.length)}\n\nAudit workspace reference document, version ${version}.\nStored and versioned inside the platform document repository.`
  return new Blob([content], { type: 'text/plain' })
}

function buildDocuments() {
  return DOC_SPECS.map((d) => {
    const [id, name, category, dept, owner, tags, versionsCount, sharedUsers, kind] = d
    const versions = []
    for (let v = 1; v <= versionsCount; v++) {
      versions.push({
        v,
        uploadedAt: ago((versionsCount - v) * 12 + 3),
        by: USER_NAME[owner],
        size: kind === 'pdf' ? 84000 + v * 2600 : kind === 'image' ? 42000 + v * 900 : 6000 + v * 1200,
        fileId: `${id}_v${v}`,
        note: v === 1 ? 'Initial upload' : `Revision ${v} - updated after review comments`
      })
    }
    return {
      id,
      name: `${name}.${DOC_TYPE_EXT[kind]}`,
      category,
      departmentId: dept,
      ownerId: owner,
      ownerName: USER_NAME[owner],
      tags,
      size: versions[versions.length - 1].size,
      type: DOC_TYPE_MIME[kind],
      uploadedAt: versions[versions.length - 1].uploadedAt,
      versions,
      sharedWith: sharedUsers.map((u) => ({ userId: u, name: USER_NAME[u], permission: 'View' })),
      description: `${category} reference material for audit teams.`,
      fileId: `${id}_v${versionsCount}`
    }
  })
}

function buildFiles() {
  const out = []
  DOC_SPECS.forEach((d) => {
    const [id, name, , , , , versionsCount, , kind] = d
    for (let v = 1; v <= versionsCount; v++) {
      out.push({ id: `${id}_v${v}`, name: `${name.replace(/[^\w .()-]/g, '')}.${DOC_TYPE_EXT[kind]}`, blob: docBody(name, kind, v) })
    }
  })
  return out
}

// ---------------------------------------------------------------- messages
function buildMessages() {
  // parts alternate senders so conversations read like real back-and-forth
  const t = (id, from, to, subject, parts) => {
    const arr = []
    parts.forEach((p, i) => {
      const sender = p[2] ? p[2] : (i % 2 === 0 ? from : to[i % to.length])
      arr.push({
        id: `${id}_${i + 1}`,
        threadId: id,
        from: sender,
        fromName: USER_NAME[sender],
        to: (sender === from ? to : [from, ...to.filter((x) => x !== sender)]),
        subject,
        body: p[1],
        timestamp: ago(p[0], 10 + i, 15 + i),
        readBy: [sender]
      })
    })
    return arr
  }
  return [
    ...t('th1', 'u_senior1', ['u_coord1'], 'HFW audit - utilisation certificates for FY ' + prevFy, [
      [8, 'Namaste Sunita ji, the first batch of utilisation certificates is missing the DDO countersignature for 3 districts. Kindly arrange signed copies before Thursday.'],
      [7, 'Priya ji, signed copies for 2 districts are being couriered today. Sitapur copy will reach by Friday - the CMO office was awaiting the treasurer signature.'],
      [6, 'Received, thank you. I will note the Sitapur delay in the audit file.']
    ]),
    ...t('th2', 'u_cao', ['u_senior1'], 'PWD tender audit - weekly status', [
      [5, 'Priya, what is the position on the single-bidder analysis for the PWD audit? The Director has asked for a position note by Monday.'],
      [4, 'Sir, 12 of 45 sampled works went to single bids. Justification memos are missing in all 12. Draft position note is ready for your review.'],
      [3, 'Good. Attach the anomaly chart from the analytics module. Keep the tone factual - this may go into the Executive Board note.']
    ]),
    ...t('th3', 'u_senior2', ['u_coord2'], 'MDM stock registers - reconciliation gap', [
      [9, 'Deepak ji, the district stock registers do not match FCI receipt entries for two quarters. We need a written reconciliation by the district officers.'],
      [8, 'Vikram ji, instructions have gone to the six districts. Two districts have already submitted their reconciliation statements.']
    ]),
    ...t('th4', 'u_director', ['u_cao'], 'Quarterly audit plan review - preparation', [
      [6, 'Rajesh, prepare the quarterly review deck - coverage against annual plan, finding trends and the risk-based plan for next quarter.'],
      [5, 'Noted ma\'am. I will pull the trend charts from the analytics module and circulate the deck by Wednesday.']
    ]),
    ...t('th5', 'u_senior1', ['u_junior1', 'u_junior2'], 'HFW field visit - division of work', [
      [10, 'Amit, you take the treasury reconciliation. Neha, please handle the voucher sampling for the two districts. We leave Monday 9 AM.'],
      [9, 'Noted ma\'am. I have prepared the sampling sheet in the work papers section.', 'u_junior2'],
      [9, 'Acknowledged. Vehicle booking is confirmed for Monday.', 'u_junior1']
    ]),
    ...t('th6', 'u_cao', ['u_senior1', 'u_senior2', 'u_senior3', 'u_junior1', 'u_junior2'], 'Audit plan Q3 - resource allocation', [
      [4, 'Team leads, please review the Q3 allocation in the planning calendar. Vikram takes the forensic scholarship audit, Priya continues PWD, Anita prepares the treasury IT audit.'],
      [3, 'Reviewed sir. One conflict - Amit Kumar is assigned to both PWD and MDM field visits in the same week.', 'u_senior1'],
      [2, 'Good catch. Neha will cover the MDM sampling instead. Allocation updated.']
    ])
  ]
}

// ---------------------------------------------------------------- notifications
function buildNotifications() {
  return [
    { id: 'n02', userId: 'u_senior1', type: 'Deadline', title: 'Field work deadline approaching', body: 'FA audit of Health & Family Welfare closes in 3 weeks. 5 checklist items still pending.', timestamp: ago(2, 17, 30), read: false, link: '#/audit/a1' },
    { id: 'n03', userId: 'u_coord1', type: 'Finding', title: 'Response requested on finding', body: 'Unspent balance of ₹12.3 crore - department response is due.', timestamp: ago(3, 11, 20), read: false, link: '#/findings' },
    { id: 'n04', userId: 'u_cao', type: 'Review', title: '1 audit awaiting your approval', body: 'CA-...-012 (Irrigation contractor payments) is under review.', timestamp: ago(1, 15, 45), read: false, link: '#/audit/a12' },
    { id: 'n05', userId: 'u_senior2', type: 'Escalation', title: 'Observation escalated to level 2', body: 'Rule 149 tendering observation (PWD) escalated to Head of Department. Remarks: compliance overdue despite reminders.', timestamp: ago(4, 10, 10), read: true, link: '#/compliance' },
    { id: 'n06', userId: 'u_junior3', type: 'Assignment', title: 'You are assigned to IA audit of CCTNS', body: 'Field work starts this week - please review the checklist.', timestamp: ago(5, 9, 30), read: true, link: '#/audit/a4' },
    { id: 'n07', userId: 'u_director', type: 'Report', title: 'Quarterly review deck requested', body: 'CAO is preparing the quarterly plan review for Monday.', timestamp: ago(6, 16, 0), read: true, link: '#/reports' },
    { id: 'n08', userId: 'u_coord2', type: 'Compliance', title: 'New observation on MDM registers', body: 'Stock reconciliation observation raised - follow-up in 12 days.', timestamp: ago(2, 13, 15), read: false, link: '#/compliance' },
    { id: 'n09', userId: 'u_admin', type: 'System', title: 'Scheduled backup completed', body: 'Nightly local backup of the workspace completed successfully.', timestamp: ago(1, 6, 30), read: false, link: '#/settings' },
    { id: 'n10', userId: 'u_senior1', type: 'Message', title: 'New message from CAO', body: 'PWD tender audit - weekly status.', timestamp: ago(3, 18, 5), read: true, link: '#/messages' },
    { id: 'n11', userId: 'u_cao', type: 'Escalation', title: 'Escalation level 1 raised', body: 'DBT uniqueness observation escalated to Department Director. Remarks: response overdue by 2 days.', timestamp: ago(1, 9, 20), read: false, link: '#/compliance' }
  ]
}

// ---------------------------------------------------------------- activity log
function buildActivity() {
  const specs = [
    ['u_cao', 'Rajesh Kumar Singh', 'Created audit', 'a12', 'CA audit of Irrigation contractor payments added to annual plan', 68],
    ['u_senior1', 'Priya Yadav', 'Uploaded evidence', 'a1', 'Utilisation certificate bundle (HFW) uploaded to evidence store', 21],
    ['u_senior2', 'Vikram Chauhan', 'Raised finding', 'f04', 'Duplicate scholarship disbursement (Critical) raised on FoA audit', 25],
    ['u_coord1', 'Sunita Devi', 'Responded to finding', 'f06', 'Department response submitted on unspent balance finding', 17],
    ['u_admin', 'Arjun Verma', 'Ran anomaly screening', 'transactions', 'Payment feed screened - 96 transactions processed', 30],
    ['u_junior1', 'Amit Kumar', 'Updated checklist', 'a1', 'Voucher testing marked completed with notes', 20],
    ['u_senior3', 'Anita Singh', 'Submitted for review', 'a12', 'Irrigation CA audit submitted to CAO for approval', 35],
    ['u_cao', 'Rajesh Kumar Singh', 'Escalated observation', 'o01', 'Rule 149 tendering observation escalated to level 2', 50],
    ['u_director', 'Dr. Meena Sharma', 'Approved report', 'r3', 'SBM performance audit report approved for issue', 55],
    ['u_junior2', 'Neha Gupta', 'Uploaded evidence', 'a2', 'MDM stock register scans (6 districts) uploaded', 12],
    ['u_senior1', 'Priya Yadav', 'Raised finding', 'f01', 'MB verification finding (Critical) raised on PWD audit', 14],
    ['u_admin', 'Arjun Verma', 'Created user', 'u_junior4', 'Junior auditor account provisioned', 60],
    ['u_cao', 'Rajesh Kumar Singh', 'Assigned team', 'a5', 'Forensic team assigned - lead: Vikram Chauhan', 44],
    ['u_senior2', 'Vikram Chauhan', 'Sent reminder', 'o03', 'DBT uniqueness reminder sent to SWF coordinator', 8],
    ['u_junior3', 'Rohit Mishra', 'Prepared work paper', 'a4', 'WP-C sampling plan prepared for CCTNS audit', 10],
    ['u_coord2', 'Deepak Kumar', 'Uploaded document', 'doc5', 'Utilisation certificate bundle shared with audit team', 16],
    ['u_cao', 'Rajesh Kumar Singh', 'Created team', 'team1', 'Financial Audit Team A created with 4 members', 90],
    ['u_admin', 'Arjun Verma', 'Updated permissions', 'roles', 'Role permissions updated for Senior Audit Officer', 75],
    ['u_senior1', 'Priya Yadav', 'Shared document', 'doc9', 'Scholarship exception report shared with CAO and Director', 19],
    ['u_cao', 'Rajesh Kumar Singh', 'Approved work paper', 'a12', 'WP-E departmental replies approved with remarks', 33]
  ]
  const kind = (id) =>
    id.startsWith('team') ? 'Team' :
    id === 'transactions' ? 'System' :
    id === 'roles' ? 'User' :
    id.startsWith('a') && id.length <= 4 ? 'Audit' :
    id.startsWith('f') ? 'Finding' :
    id.startsWith('o') ? 'Observation' :
    id.startsWith('r') ? 'Report' :
    id.startsWith('doc') ? 'Document' :
    id.startsWith('u') ? 'User' : 'System'
  return specs.map((s, i) => ({
    id: `act_${String(i + 1).padStart(3, '0')}`,
    userId: s[0],
    userName: s[1],
    action: s[2],
    entityType: kind(s[3]),
    entityId: s[3],
    details: s[4],
    timestamp: ago(s[5], 11 + (i % 8), (i * 13) % 60),
    location: 'Lucknow'
  }))
}

// ---------------------------------------------------------------- login events
function buildLoginEvents() {
  const rnd = seededRandom('logins-v1')
  const browsers = [
    ['Chrome 128', 'Windows 11', 'Desktop'],
    ['Edge 127', 'Windows 11', 'Desktop'],
    ['Firefox 129', 'Windows 10', 'Desktop'],
    ['Chrome 127', 'Android 14', 'Mobile'],
    ['Safari 17', 'macOS 14', 'Desktop']
  ]
  const specs = [
    ['u_admin', 0, 1, 'Success', 'Password'], ['u_admin', 1, 1, 'Success', 'Password'], ['u_admin', 2, 0, 'Failed', 'Password'],
    ['u_director', 0, 1, 'Success', 'Office SSO'], ['u_director', 1, 1, 'Success', 'Office SSO'],
    ['u_cao', 0, 1, 'Success', 'Password'], ['u_cao', 1, 1, 'Success', 'Password'],
    ['u_senior1', 0, 1, 'Success', 'Password'], ['u_senior1', 1, 1, 'Success', 'Password'], ['u_senior1', 2, 1, 'Success', 'Password'],
    ['u_senior2', 0, 1, 'Success', 'Password'], ['u_senior2', 1, 0, 'Failed', 'Password'],
    ['u_senior3', 0, 1, 'Success', 'Password'],
    ['u_junior1', 0, 1, 'Success', 'Password'], ['u_junior2', 1, 1, 'Success', 'Password'], ['u_junior3', 0, 1, 'Success', 'Password'],
    ['u_coord1', 0, 1, 'Success', 'Password'], ['u_coord2', 1, 1, 'Success', 'Password'], ['u_coord1', 2, 0, 'Failed', 'Password']
  ]
  return specs.map((s, i) => {
    const b = browsers[Math.floor(rnd() * browsers.length)]
    const [userId, daysAgo, , status, via] = s
    return {
      id: `le_${String(i + 1).padStart(3, '0')}`,
      userId,
      userName: USER_NAME[userId],
      timestamp: ago(daysAgo, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)),
      ip: null, // filled in buildAllSeedData
      browser: b[0],
      os: b[1],
      device: b[2],
      via,
      status
    }
  })
}

// ---------------------------------------------------------------- teams
function buildTeams() {
  return [
    { id: 'team1', name: 'Financial Audit Team A', leadId: 'u_senior1', leadName: USER_NAME['u_senior1'], memberIds: ['u_junior1', 'u_junior2', 'u_senior2'], description: 'Core financial audit team handling expenditure verification, treasury reconciliation and utilisation certificate reviews.', specialisation: 'Financial', status: 'Active', createdAt: ago(210) },
    { id: 'team2', name: 'Forensic & Fraud Team', leadId: 'u_senior2', leadName: USER_NAME['u_senior2'], memberIds: ['u_junior1', 'u_junior4'], description: 'Specialist team for fraud investigations, funds tracing and vendor due diligence.', specialisation: 'Forensic', status: 'Active', createdAt: ago(180) },
    { id: 'team3', name: 'IT Audit Cell', leadId: 'u_senior3', leadName: USER_NAME['u_senior3'], memberIds: ['u_junior3'], description: 'System security reviews, access control audits and audit trail verification.', specialisation: 'IT', status: 'Active', createdAt: ago(160) },
    { id: 'team4', name: 'Performance Review Team', leadId: 'u_senior3', leadName: USER_NAME['u_senior3'], memberIds: ['u_junior4', 'u_junior2'], description: 'Scheme performance audits, beneficiary verification and outcome assessment.', specialisation: 'Performance', status: 'Active', createdAt: ago(120) },
    { id: 'team5', name: 'Compliance Cell B', leadId: 'u_senior1', leadName: USER_NAME['u_senior1'], memberIds: ['u_junior4'], description: 'Tendering and procurement compliance reviews for works departments.', specialisation: 'Compliance', status: 'Inactive', createdAt: ago(260) }
  ]
}

// ---------------------------------------------------------------- reports & templates
function buildTemplates() {
  return [
    {
      id: 'tpl1', name: 'Executive Audit Summary', description: 'One-page summary for the Director: objectives, key findings, risk rating and recommendation.',
      sections: ['Header & Audit Reference', 'Objectives & Scope', 'Key Findings Summary', 'Risk Rating', 'Recommendations'], type: 'Executive',
      accent: '#8b53ac', footer: 'Audit & Compliance Wing - Confidential', showCover: true, showTOC: false
    },
    {
      id: 'tpl2', name: 'Detailed Audit Report', description: 'Full report with findings, evidence references, department responses and annexures.',
      sections: ['Header & Audit Reference', 'Introduction & Background', 'Objectives & Scope', 'Methodology', 'Findings & Analysis', 'Department Responses', 'Recommendations', 'Annexure: Checklist Status'], type: 'Detailed',
      accent: '#036dc9', footer: 'Audit & Compliance Wing - Confidential', showCover: true, showTOC: true
    },
    {
      id: 'tpl3', name: 'Compliance Status Report', description: 'Department-wise compliance position on open observations with ageing.',
      sections: ['Header', 'Compliance Summary', 'Observation-wise Status', 'Ageing Analysis', 'Escalations'], type: 'Compliance',
      accent: '#0f766e', footer: 'Audit & Compliance Wing', showCover: false, showTOC: false
    },
    {
      id: 'tpl4', name: 'Department Performance Review', description: 'Benchmarking of departments on compliance rate, findings density and audit coverage.',
      sections: ['Header', 'Benchmark Scores', 'Trend Analysis', 'Risk Ratings', 'Recommended Audit Plan'], type: 'Performance',
      accent: '#0488fb', footer: 'Audit & Compliance Wing', showCover: true, showTOC: false
    },
    {
      id: 'tpl5', name: 'Annual Audit Plan Summary', description: 'Year-wise plan coverage: audits by type, department, quarter and resources.',
      sections: ['Header', 'Plan Overview', 'Coverage by Department', 'Resource Allocation', 'Risk-Based Selection Rationale'], type: 'Planning',
      accent: '#70428a', footer: 'Audit & Compliance Wing', showCover: true, showTOC: true
    }
  ]
}

function buildReports() {
  return [
    {
      id: 'r1', title: `Financial Audit Report - Health & Family Welfare FY ${prevFy}`, templateId: 'tpl2', templateName: 'Detailed Audit Report',
      auditId: 'a1', departmentId: 'd_hfw', status: 'Draft', generatedBy: 'u_senior1', generatedByName: 'Priya Yadav',
      generatedAt: ago(5), approvedBy: null, approvedAt: null, version: 1,
      summary: 'Draft consolidated report covering expenditure verification, unspent balances and advance adjustment across seven CMO offices.'
    },
    {
      id: 'r2', title: 'Performance Audit Report - Kanya Sumangala Scheme', templateId: 'tpl2', templateName: 'Detailed Audit Report',
      auditId: 'a7', departmentId: 'd_swf', status: 'Final', generatedBy: 'u_senior3', generatedByName: 'Anita Singh',
      generatedAt: ago(40), approvedBy: 'Dr. Meena Sharma (Director)', approvedAt: ago(32), version: 3,
      summary: 'Final report issued to the department. Coverage of 1.9 lakh beneficiaries verified; installment delays and Aadhaar seeding gaps documented with department responses.'
    },
    {
      id: 'r3', title: 'Performance Audit Report - Swachh Bharat Mission (Urban)', templateId: 'tpl2', templateName: 'Detailed Audit Report',
      auditId: 'a15', departmentId: 'd_urb', status: 'Approved', generatedBy: 'u_senior2', generatedByName: 'Vikram Chauhan',
      generatedAt: ago(25), approvedBy: 'Rajesh Kumar Singh (CAO)', approvedAt: ago(20), version: 2,
      summary: 'Report approved by CAO and awaiting final issue by the Director. Documents non-functional community toilets and O&M fund diversion.'
    },
    {
      id: 'r4', title: 'Compliance Audit Report - Police Modernisation Funds', templateId: 'tpl2', templateName: 'Detailed Audit Report',
      auditId: 'a16', departmentId: 'd_pol', status: 'Final', generatedBy: 'u_senior3', generatedByName: 'Anita Singh',
      generatedAt: ago(90), approvedBy: 'Dr. Meena Sharma (Director)', approvedAt: ago(85), version: 2,
      summary: 'Final report issued; all observations closed after GPS installation was verified.'
    },
    {
      id: 'r5', title: 'Compliance Audit Report - Irrigation Contractor Payments', templateId: 'tpl2', templateName: 'Detailed Audit Report',
      auditId: 'a12', departmentId: 'd_irr', status: 'In Review', generatedBy: 'u_senior1', generatedByName: 'Priya Yadav',
      generatedAt: ago(3), approvedBy: null, approvedAt: null, version: 1,
      summary: 'Submitted for CAO review. Covers mobilisation advance recoveries and lapsed bank guarantees.'
    }
  ]
}

// ---------------------------------------------------------------- integrations (SSO only)
function buildIntegrations() {
  return [
    {
      id: 'int_sso',
      name: `${config.ssoProviderName} - Single Sign-On`,
      type: 'Identity Provider',
      status: 'Connected',
      endpoint: 'https://sso.internal.example/oauth2',
      lastSync: ago(0, 8, 0),
      recordsSynced: null,
      description: 'Central identity provider for platform sign-in. Employees authenticate with their office credentials.',
      config: { protocol: 'OAuth 2.0 / SAML', scope: 'audit-platform', MFA: 'Enabled' },
      logs: [
        { time: ago(0, 8, 0), event: 'Token refresh successful', status: 'OK' },
        { time: ago(1, 9, 12), event: 'User login via SSO - meena.sharma', status: 'OK' },
        { time: ago(2, 10, 2), event: 'Certificate rotation completed', status: 'OK' }
      ]
    }
  ]
}

function buildEmailOutbox() {
  return [
    { id: 'e1', to: 'sunita.devi@auditms.in', subject: 'Reminder: response due on unspent balance finding', body: 'Dear Coordinator, the department response on the unspent balance finding is overdue by 2 days.', timestamp: ago(2, 10, 0), via: 'Email gateway' },
    { id: 'e2', to: 'deepak.kumar@auditms.in', subject: 'Follow-up: MDM stock reconciliation', body: 'Please arrange the written reconciliation statements from the six districts.', timestamp: ago(4, 14, 30), via: 'Email gateway' }
  ]
}

// ---------------------------------------------------------------- main
export function buildAllSeedData() {
  const audits = buildAudits()
  const evidenceFiles = []
  audits.forEach((a) => {
    ;(a.evidence || []).forEach((ev) => {
      const content = `EVIDENCE: ${ev.name}\nAUDIT: ${a.code} - ${a.title}\nUPLOADED BY: ${ev.uploadedBy}\n\nCollected during field work for ${a.departmentName}. Stored in the platform evidence store.`
      evidenceFiles.push({ id: ev.fileId, name: ev.name.replace(/[^\w .()-]/g, '') + '.txt', blob: new Blob([content], { type: 'text/plain' }) })
    })
  })
  const auditCodeById = Object.fromEntries(audits.map((a) => [a.id, a.code]))
  const findings = buildFindings().map((f) => ({ ...f, auditCode: auditCodeById[f.auditId] || '' }))
  const deptById = Object.fromEntries(audits.map((a) => [a.id, a.departmentId]))
  findings.forEach((f) => { f.departmentId = deptById[f.auditId] || f.departmentId })
  const observations = buildObservations()
  observations.forEach((o) => {
    o.departmentId = deptById[o.auditId] || o.departmentId
  })
  const loginEvents = buildLoginEvents().map((le) => ({ ...le, ip: ipFor(le.userId, le.timestamp) }))

  return {
    users: WORKSPACE_USERS.map((u) => ({
      id: u[0], name: u[1], email: u[2], password: config.defaultPassword, role: u[3],
      designation: u[4], departmentId: u[5], phone: '+91 9' + String(100000000 + Math.abs(u[0].split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % 899999999),
      status: 'Active', avatarColor: u[6], joined: ago(300 + (u[0].length * 40)), lastLogin: ago(1, 9, 30)
    })),
    departments: DEPARTMENTS.map((d) => ({
      id: d[0], code: d[1], name: d[2], headName: d[3], headDesignation: d[4],
      annualBudget: d[5], employeeCount: d[6],
      units: d[7].map((u, i) => ({ id: `${d[0]}_u${i + 1}`, name: u[0], head: u[1], staffCount: u[2] })),
      contactEmail: `contact.${d[1].toLowerCase()}@auditms.in`,
      contactPhone: '+91 522 ' + String(2200000 + (d[0].charCodeAt(3) * 7919) % 70000).slice(0, 5),
      address: 'Administrative Campus, Lucknow', city: 'Lucknow',
      established: 1950 + ((d[0].charCodeAt(2) * 13) % 60),
      lastAuditDate: null,
      status: 'Active'
    })),
    audits,
    findings,
    observations,
    transactions: buildTransactions(),
    documents: buildDocuments(),
    files: [...buildFiles(), ...evidenceFiles],
    messages: buildMessages(),
    notifications: buildNotifications(),
    activity: buildActivity(),
    reports: buildReports(),
    templates: buildTemplates(),
    integrations: buildIntegrations(),
    checklistTemplates: buildChecklistTemplateLibrary(),
    teams: buildTeams(),
    loginEvents,
    rolePermissions: defaultRolePermissions(),
    emailOutbox: buildEmailOutbox()
  }
}

export const CHECKLIST_TEMPLATE_LIST = CHECKLIST_TEMPLATES
