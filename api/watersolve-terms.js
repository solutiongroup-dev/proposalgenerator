/**
 * WaterSolve fixed legal text, copied verbatim from WaterSolve's own proposals
 * (070626 Dredging and Dewatering Proposal.docx, 100626 Proposal Firestone project.xlsx).
 * This text is never sent to Claude for rewriting. Edit here if Legal updates it.
 */

const SPECIAL_TERMS_INTRO = "In addition to WaterSolve's Standard Terms & Conditions, the following terms apply to this Sales Proposal unless otherwise noted above:";

const SPECIAL_TERMS = [
  "A geotextile tube dewatering performance trial, chemical conditioning program, and hanging bag performance test are required before start up.",
  "Customer shall complete a Credit Application at the time of the initial order.",
  "The Contract Price excludes all taxes (sales and use), special delivery, freight surcharges after proposal date, or freight differentials for quantities smaller than the volumes listed on page 1. The Contract Price is in US Dollars ($).",
  "Customer shall prepare the lay-down area and verify (0.0% side to side and maximum 0.5% end to end) in accordance with WaterSolve's Standard Terms & Conditions.",
  "Customer shall be responsible for any change in project design or material character including all resulting change orders. Costs to implement Customer design changes after design approval shall be charged at WaterSolve's customary hourly rate.",
  "Customer is responsible for all permitting with applicable regulatory agencies.",
  "Customer is responsible for all site conditions, including the presence, handling and disposal of hazardous materials. WaterSolve disclaims any responsibility, liability, or duty to investigate site conditions. Empty tote and drum containers are the customer's responsibility for disposal.",
  "Fuel is provided by others unless specified in the proposal.",
  "Gas monitoring is provided by others unless specified in the proposal.",
  "Unspecified debris removal (non-native materials) located in the area to be pumped out is the responsibility of others, and any costs/delays due to debris removal will result in standby rates.",
  "If Seller is engaged to provide on-site services, Seller will provide such services Monday – Saturday, not to exceed 12 hours per day.",
  "Customer shall notify WaterSolve of any special wage requirements at time of order. Special wage requirements may result in increased daily rates from those listed on page 1. Daily rates include travel and on-site time. Holidays will be charged at double the daily rate, if worked, and at normal daily rate if standby is required after mobilization, unless specified in the proposal.",
  "Equipment Rental includes mixing manifold, injection port, sampling ports, and geotextile tube injection ports (all schedule 40 PVC with cam-lock fittings), as applicable. Equipment rental is one-month minimum. Rental rates shall be pro-rated after each complete month.",
  "Project Work Order must be completed before beginning of project. Additional work outside of the Sales Proposal may cause additional charges and delays.",
  "Clean water and electrical power to polymer make-down unit are to be provided by others.",
  "Custom made products require one half of Product cost paid at time of order. Restocking fees on custom size products may apply.",
  "Customer shall pay mobilization charges when mobilization to the job site is complete. Mobilization charges include travel, shipping and expenses to transport the personnel and equipment to the site and one day of time for set up at the site unless otherwise noted. After one day on-site, daily rates apply until the project is complete. If delays are encountered that do not require WaterSolve to be on site and provided Customer timely notifies WaterSolve, Customer shall pay WaterSolve its Standby Rate equal to two thirds of WaterSolve's established daily wage rates. A change in project start date may result in mobilization penalties.",
  "Standby rates will be at normal daily rates for any equipment on site.",
  "Polymer selection and quantity and geotextile tube capacity is based upon testing of Customer's sample. The Sales Proposal assumes that samples obtained are representative of the site. Customer hereby assumes the entire responsibility and liability for testing and determining the site conditions and material characteristics, and obtaining and providing Watersolve samples representative of the material to be treated. Watersolve is not responsible for familiarizing or determining the actual site conditions or testing of any material characteristics to samples provided are representative of all materials present. Therefore, Watersolve makes no implied warranty of any kind that its Product(s) are suitable for Customer's intended use. Customer understands that the material characteristics or any other factors of the sample provided to Watersolve, by Customer, may differ from the actual site conditions. Customer understands that the sampling techniques such as composite sampling, may mask materials that may result in delays and difficulty treating the actual site materials. Customer shall be responsible to make sure Products(s) used are per Owner's specifications. Customer assumes full liability for any loss, damage, delay from the use of Watersolve's Product(s) and shall hold Watersolve harmless from any and all causes of action related to the use of Watersolve's Products(s) due to material character changes from the samples tested.",
  "Any unit pricing for materials is subject to change due to the increase or decrease of 24% of quoted quantities.",
  "Bonding Costs and Insurance Limits beyond WaterSolve's current limits are not included in the price.",
  "NO PARTY SHALL BE LIABLE FOR LIQUIDATED, SPECIAL, PUNITIVE, EXEMPLARY, INCIDENTAL, CONSEQUENTIAL OR INDIRECT DAMAGES OR LOST PROFITS, WHETHER BASED ON CONTRACT, TORT, STRICT LIABILITY, OTHER LAW OR OTHERWISE AND WHETHER OR NOT ARISING FROM THE OTHER PARTY’S SOLE, JOINT OR CONCURRENT NEGLIGENCE, STRICT LIABILITY OR OTHER FAULT. Notwithstanding anything else in this Agreement to the contrary, WaterSolve’s aggregate liability for any and all damages of any kind arising out of or related, in whole or in part, to this Agreement shall be limited to the amount that is equal to the Contract Price hereunder",
  "In the case of Force Majeure, All work that has been completed, including Mobilization and Demobilization, and restocking and shipping of return of custom products, to be included in that month's invoicing to be paid in full.",
  "Client will not withhold any payment \"holdbacks\"."
];

const WARRANTY_DISCLAIMER = "WaterSolve makes no implied warranty of any kind. Customer is solely responsible for determining whether or not Product(s) is suitable for Customer's intended uses. WaterSolve shall not be held liable for any geotextile tube site excavation or surveying to determine if land is suitable for lay-down. Technical service is limited to setup and operation of WaterSolve equipment. Any other technical advice or information is given without consideration. No such information or advice relieves the Customer from ultimate liability to ensure products are used properly per specifications or from Customer's sole responsibility to determine whether the Product(s) is suitable or desirable for Customer's intended use.";

const STANDARD_TERMS_TITLE = "WATERSOLVE, LLC - STANDARD TERMS & CONDITIONS";

const STANDARD_TERMS = [
  {
    "num": "1.",
    "text": "Contract. WaterSolve’s Order Acknowledgement (“Order”) and these Standard Terms & Conditions constitute the complete Contract (“Contract”) between WaterSolve, LLC (“Seller”) and Customer. This Contract is also subject to the terms and conditions of Customer’s Credit Application.",
    "sub": false
  },
  {
    "num": "2.",
    "text": "Contract Formation. Customer’s ordering of any Product or service, Customer’s issuance of any Purchase Order to Seller, Seller’s performance of any service, or Seller’s shipment of any Product shall constitute Customer’s acceptance of these Terms & Conditions. No additional or contrary term in any Customer document is binding upon Seller unless agreed to in writing and signed by Seller’s authorized officer. Seller’s performance is condition upon Customer’s unmodified consent exclusively to these terms.",
    "sub": false
  },
  {
    "num": "3.",
    "text": "Contract Change. This Contract may be modified only by written authorization of a Vice President of Seller. Customer may not rely on Seller’s performance, course of dealing, or other conduct as a modification of the Contract. Seller’s failure to exercise a right or insist on strict compliance with the Contract shall not be deemed a waiver by Seller. Customer may not rely on any failure to enforce any rights as a course of dealing. No waiver by Seller of any breach of the Contract will be a waiver of any other breach.",
    "sub": false
  },
  {
    "num": "4.",
    "text": "Definitions. “Circumstances Over Which Seller Has No Control” means circumstances over which Seller has no reasonably cost-effective control, including: weather conditions, raw materials and third-party item shortages; power and fuel shortages; unavailability of transportation, including transportation for delivery of raw materials and third-party items; fire, floods, and other acts of God; strikes, lockouts, and shut downs; equipment failures; wars, civil riots, embargoes, blockades, trade sanctions and restrictions, and other government actions; and compliance with any law. “Includes” and “including” do not exclude an item not listed. “May” signifies a right that a party may or may not exercise, without waiving the right. “Or” includes the conjunction of two or more of multiple elements. “Product” means the materials and other goods and services (if any) described in the Order. “Rights” includes all rights and remedies available to Seller at law, in equity and under the Contract. All rights are cumulative and may be exercised individually or concurrently. “Third-party item” means any product supplied by third parties.",
    "sub": false
  },
  {
    "num": "5.",
    "text": "Customer-supplied information. Seller may rely upon the accuracy of any information supplied by Customer, including drawings, technical information, testing data, sample submittals, process parameters and material quantities. Seller disclaims any responsibility, liability or duty to investigate of and for existing site conditions, adequacy of lay down areas, accuracy of sampling, that samples obtained are representative of site, changed conditions and condition of existing liner. Customer expressly acknowledges that any composite sample provided may mask actual, existing conditions and Customer assumes the risk associated with composite samples, including additional costs for changes in design or material.",
    "sub": false
  },
  {
    "num": "6.",
    "text": "Customer Responsibility. Customer shall: (a) provide unimpeded site access; (b) provide proper lighting and security to protect against theft of Seller’s equipment; (c) prepare lay-down areas and verify that lay-down area is free of sharp objects and debris; (d) perform any required site investigation; (e) perform any required surveying; (f) establish and verify site grades (0.0% side-to-side and maximum 0.5% end-to-end) and ensure that graded conditions conform to design drawings, specifications, and standard Geotube® SOP requirements; (g) supply all utilities, including clean water and electrical power; (h) secure and pay for necessary approvals, easements, permits and licenses; (i) comply with any applicable law, rule or regulatory requirement, including permitting; (j) conform to any permitting requirements for the discharge of water; (k) adhere to SDS/MSDS for products and proper personal protective equipment; (l) assume all risk for the status of any liner not supplied by Seller; and (m) assume all risk of damage to existing liner during the course of Seller’s work.",
    "sub": false
  },
  {
    "num": "7.",
    "text": "Mobilization. If Seller is providing any on-site services, Seller shall be entitled to a mobilization fee. Customer shall pay the mobilization fee upon completion of mobilization to Customer’s site. The mobilization fee includes travel, shipping and expenses to transport personnel and equipment to the site. Customer’s change to Seller’s established project start date may result in mobilization penalties and additional charges. If delays are encountered after mobilization such that Seller’s personnel are not required to be on site, and provided Customer promptly notifies Seller of such conditions, Customer shall pay Seller its Standby Rate equal to two thirds (2/3) of Seller’s established daily wage rates. If a prolonged disruption in its work occurs, Seller may demobilize equipment and personnel from the site and Customer shall be responsible for Seller’s actual demobilization costs and any subsequent re-mobilization costs.",
    "sub": false
  },
  {
    "num": "8.",
    "text": "Technical Assistance. To the extent Seller is engaged to provide on-site services, Seller shall provide such services Monday – Saturday, not to exceed ten (10) hours per day, unless otherwise noted. Before ordering any Products and before engaging any of Seller’s services, Customer shall advise Seller of any special wage requirements, including the requirement to pay state or federal prevailing wages. Special wage requirements may result in daily wage rates higher than those identified in Seller’s Sales Proposal.",
    "sub": false
  },
  {
    "num": "9.",
    "text": "Deviation from Standards. Any quotation, proposal or similar description (hereafter, collectively, “Description”) by Seller of materials or services to be supplied by Seller in connection with this Contract or any quote by Seller in response or reference to a particular set of plans or specifications shall be construed and presumed to be a general Description of such materials and services, incorporating Seller’s standard and ordinary details, materials, and scope of products contracted for (hereafter, collectively “Seller Standards”). Seller is not obligated to furnish or accommodate any additions to or variations (hereafter “Variations”) from Seller Standards unless such Variations are specifically included in a document signed by an authorized Seller representative, and unless such Variations are expressly and conspicuously identified as being different from or additional to Seller Standards. Such Variations shall not be implied in any manner nor shall they be merely incorporated by reference to plans or specifications or other descriptions outside of the express provisions of this Contract or express provisions of Descriptions given by Seller. In the event of conflict, inconsistency, or ambiguity between any plans and specifications furnished by or on behalf of Customer and Seller Standards, Seller Standards shall control.",
    "sub": false
  },
  {
    "num": "10.",
    "text": "Shipment Quantities, Dates, and Returns. Customer shall give Seller reasonable notice of Product quantities and shipping instructions. Seller shall not be obligated to ship product if: reasonable notice of quantities and instruction is not given; the amount is unreasonably disproportionate to the scheduled amounts; the amount exceeds estimates provided by Customer to which Seller has agreed in writing; or if, in Seller’s sole judgment, the amount is disproportionate to the total amount in the Contract. Expedited orders (those that must be shipped in less than 48 hours) may be subject to $250 expediting fee in addition to all other extra transit fees. All shipping dates (including firm shipping dates) may change as a result of Circumstances Over Which Seller Has No Control. Any product that meets specifications set forth in a quote or MSDS may be returned, subject to a thirty-five (35) percent restocking fee (35% of quoted price) if sent back within 15 days of receipt at Customer’s expense. The product must not have been opened or contaminated in any way. Seller has no obligation to accept conforming products returned after 15 days. Seller may impose additional restocking fees on return of custom-sized products. Customer acknowledges that Seller may not have on hand in Sellers' open stock all of the items purchased by Customer and that Seller will be relying on Customer's agreement to purchase such items as a basis for Seller to enter into binding agreement with others for the delivery of such items. Because of Seller’s reliance Customer's obligation to purchase the Product shall be unconditional and irrevocable.",
    "sub": false
  },
  {
    "num": "11.",
    "text": "Delivery Terms. Unless specified otherwise, delivery terms are CIP (Incoterms, 2010), Customer’s project site. Seller’s weights establish quantities delivered to the Customer.",
    "sub": false
  },
  {
    "num": "12.",
    "text": "Nonconforming Product. Customer shall inspect all Product promptly upon receipt. Within two (2) days after delivery of Product, Customer shall notify Seller in writing of any non-conforming Product or any deficiencies or shortages; otherwise Customer waives all such claims. Customer’s use or resale of any Product claimed to be non-conforming or deficient shall constitute Customer’s acceptance of such items. Customer shall not withhold payment or adjust the amount of the Contract Price because of any such claim. Customer’s sole remedy shall be the replacement or repair by Seller, at Seller's sole option, of non-conforming or deficient items in accordance with the Disclaimer and Limited Warranty.",
    "sub": false
  },
  {
    "num": "13.",
    "text": "Prices. The Contract Price excludes all taxes, demurrage charges, special freight delivery terms (Expedited, Weekend or Holiday fees, or freight differentials for quantities smaller than identified in the Sales Proposal) unless otherwise stated in the Sales Proposal. Customer shall pay all present and future taxes applicable to the sale or use of the Product (including sales, use, excise, and value-added taxes). If the Product is shipped by tank car provided by Seller, Customer shall: pay all demurrage and other charges by the carrier; unload the tank car within seven (7) business days after arrival at the destination; and pay a retention charge at Seller’s then current rate for each day or fraction of a day (including Sundays and holidays) that Customer retains the tank car after the seven (7) business day period.",
    "sub": false
  },
  {
    "num": "14.",
    "text": "Changes. All changes in the engineering details of any order which Customer requests after final approval of design or drawings are subject to additional charges, including engineering charges and factory charges on any work affected by the change. Such charges shall be added to the Contract Price.",
    "sub": false
  },
  {
    "num": "15.",
    "text": "Custom Orders. For custom-sized Products, Customer shall pay Seller one half (1/2) of the Product price at the time of Customer’s order.",
    "sub": false
  },
  {
    "num": "16.",
    "text": "Payment. Customer shall pay the Contract Price in United States dollars. Seller may apply payments to oldest matured invoices first. Payment is due net thirty (30) days from the date of shipment unless otherwise specified. Customer shall pay interest at the rate of eighteen percent (18%) per annum on any invoice not paid within thirty (30) days from the date of shipment.",
    "sub": false
  },
  {
    "num": "17.",
    "text": "Limited Warranty. Seller warrants that all Products except third-party items will conform to the description in the Order and to Seller’s Product specifications. Seller warrants that the Product has been produced in compliance with the Fair Labor Standards Act of 1938, as amended. Seller assigns to Customer all of its rights under warranties of third-party items.",
    "sub": false
  },
  {
    "num": "(a)",
    "text": "Disclaimer of Warranty. Seller makes no express or implied warranty of merchantability. Seller makes no express or implied warranty of fitness for a purpose. Seller makes no express warranty except as described in this paragraph. Seller makes no implied warranty of any kind. Customer is solely responsible for determining whether or not Product is suitable for Customer’s intended uses. Seller will not be held liable for any Geotube site excavation or surveying to determine if land is suitable for laydown. Technical Service is limited to setup and operation of Seller equipment. Any other technical advice requested from Customer is only for informational purposes and such advice does not relieve Customer from ultimate liability to ensure products are used properly and per specifications. Any information or technical advice provided to Customer has been given without consideration, and no such information or advice relieves Customer from sole responsibility to determine whether the Product is suitable for Customer’s intended use, including the responsibility to determine whether the Product is desirable.",
    "sub": true
  },
  {
    "num": "(b)",
    "text": "Remedies. The remedies in this Contract are the only remedies for any failure of the Product to conform to any warranty or for Seller’s breach of any other obligation or for any other claim against Seller that may arise in connection with the Contract. Seller will replace any Product, except third-party items, for which Customer has given Seller written notice of defect within two (2) days from the date of receipt, and for which Seller has verified the defect. Remedies are further limited in other provisions of this Contract.",
    "sub": true
  },
  {
    "num": "(c)",
    "text": "Liabilities. Seller shall not be liable for any special, consequential, incidental, or penal damages, regardless of the legal theory alleged, (including negligence and strict liability), or other rights including, but not limited to, damages attributable to loss of profits of revenues, loss of production, loss of the use of the Product, cost of substitute equipment or facilities, down time costs, increased construction costs, equipment and tank cleaning, and claims of Customer’s customers or contractors. Customer shall indemnify, defend and hold Seller harmless from all claims by third parties arising out of or in connection with the Contract, service or Product, including, but not limited to, claims for personal injury, property damage, economic loss, or costs of litigation. Customer shall reimburse Seller for all attorneys’ fees and any other costs incurred in connection with the defense of any such claim. Seller shall not be liable for any damages that might occur due to the presence or conditions of any utilities or materials located around and under any part of Customer’s premises",
    "sub": true
  },
  {
    "num": "18.",
    "text": "Maintenance of Labels. Customer shall maintain all labels, product information materials, and warnings for the Product supplied by Seller or on any container for the Product, and shall restore any such materials that have been damaged, defaced, or otherwise made difficult to read.",
    "sub": false
  },
  {
    "num": "19.",
    "text": "Defaults. Seller may delay shipment, reduce amounts shipped, or terminate the Contract if (a) Customer fails to make any payment promptly when due or otherwise fails to comply with the Contract, (b) Customer ceases to conduct its operations in the normal course of business, (c) Customer is or becomes unable to pay its obligations as they mature, (d) any proceeding under the Bankruptcy Code or any other insolvency law is brought by or against Customer, (e) a receiver for Customer is appointed or an application for a receiver is filed, (f) Customer makes an assignment for the benefit of creditors, or (g) Customer fails to provide adequate assurance of future performance within fifteen (15) days after demand by Seller (which will constitute a repudiation by Customer of the unperformed portion of the Contract). Customer shall reimburse Seller for all costs, including attorneys’ fees, incurred by Seller in connection with enforcing the Contract or any right accruing to Seller as a result of the Customer’s breach of Contract.",
    "sub": false
  },
  {
    "num": "20.",
    "text": "Assurance of Performance. Seller may demand from Customer adequate assurance of future performance acceptable to Seller whenever Seller has reasonable grounds for insecurity concerning Customer’s performance. Until it receives adequate assurance of future performance, Seller may suspend its performance under the Contract. “Reasonable grounds for insecurity” includes the circumstances described in ¶19. “Adequate assurances of future performance acceptable to Seller” will depend on the circumstances.",
    "sub": false
  },
  {
    "num": "21.",
    "text": "Limitations on Claims. Legal proceedings on any claim by Customer or any other party against Seller in any way related to the Contract must be brought within one year from the date of shipment of the Product from Seller’s facilities or manufacturer’s facility. Customer waives all proceedings not brought within one year from the date of Product shipment and all claims and defenses that could have been asserted in such proceedings.",
    "sub": false
  },
  {
    "num": "(a)",
    "text": "Limitation of Remedy. Regardless of any other provision in the Contract or in any other contract between the parties, Seller’s liability for damages shall be limited to the consideration actually paid to Seller under the Contract. This limitation covers all claims in any way arising out of or resulting from the Contract, regardless of the legal theory alleged, including negligence and strict liability.",
    "sub": true
  },
  {
    "num": "(b)",
    "text": "No Damages for Delay. Seller shall not be liable for, and Customer covenants not to assert against Seller, any claims or demands for construction or project delays, disruptions, interference, or other losses, damages, costs or expenses of any nature whatsoever, attributed to delays in engineering, shipping, delivery or other performance required of Seller or caused by or attributed to missing, misfabricated or otherwise defective or deficient drawings, parts, materials and products. No written or oral representation, promise, or undertaking of Seller as to any proposed, anticipated, planned or required date shall be construed to be an undertaking by Seller to assume liability for losses, costs or damages of the type and kind disclaimed in the preceding sentence. If any portion of this disclaimer is determined to be subject to a common law or statutory exception, or is otherwise held to be unenforceable in whole or part, the remaining portion shall be unaffected. UNDER NO CIRCUMSTANCES WHATSOEVER SHALL SELLER BE LIABLE FOR CONSEQUENTIAL OR INCIDENTAL DAMAGES FROM ANY DELAY. Customer covenants not to assert any claim against Seller in any legal or quasi-legal proceeding that is inconsistent with this provision. Breach of this covenant shall entitle Seller to recover damages for the costs and expenses, including attorneys’ fees, Seller incurs defending against such claims.",
    "sub": true
  },
  {
    "num": "22.",
    "text": "Safety. For any work performed on Customer’s premises, Customer shall furnish a work place free from hazards that may cause harm and Customer agrees to take all reasonable precautions for the safety of Seller’s employees, agents or subcontractors. Customer shall comply with all applicable federal and state safety laws, regulations and orders of any public authority. Customer shall hold harmless, defend and indemnify Seller from any claim, damage, loss or fine, including attorney fees arising from Customer’s failure to comply with any safety requirement, except where Seller is adjudged to be solely negligent.",
    "sub": false
  },
  {
    "num": "23.",
    "text": "Hazardous Materials. To the fullest extent permitted by law, Customer shall indemnify, defend and hold harmless Seller and Seller’s consultants, agents and employees from and against claims, damages, losses and expenses, including attorney fees arising out of the presence of any hazardous materials on Customer’s premises.",
    "sub": false
  },
  {
    "num": "24.",
    "text": "Force Majeure. Seller will not be liable to Customer for any inability to perform the Contract attributable to circumstances over which Seller has no control. If Circumstances Over Which Seller Has No Control occur, Seller’s time for performance will be extended by the period of any delay attributable to the circumstances, and Seller will be excused from delivery of the Product or may allocate Product among Customers.",
    "sub": false
  },
  {
    "num": "25.",
    "text": "Security Interest. The Customer grants and Seller retains a purchase money security interest in the products purchased hereunder until the net Contract Price is fully paid and all other obligations of the Customer are satisfied.",
    "sub": false
  },
  {
    "num": "26.",
    "text": "Assignments. Customer may not assign all or any part of this Contract without the written consent of Seller.",
    "sub": false
  },
  {
    "num": "27.",
    "text": "Applicable Law. The Contract shall be construed under the laws of the United States of America and the State of Michigan. The United Nations Convention on Contracts for the International Sale of Goods shall not apply.",
    "sub": false
  },
  {
    "num": "28.",
    "text": "Arbitration. At the sole option of Seller, all disputes of any kind shall be decided by Arbitration and governed by the applicable rules of the American Arbitration Association (AAA) existing when the claim arose. The award of the arbitrator shall be final and binding and shall be enforceable in a Court of competent jurisdiction. The sole, exclusive venue for arbitration or any legal proceeding shall in Kent County, Michigan. This venue provision shall control over any contrary AAA rule.",
    "sub": false
  }
];

module.exports = { SPECIAL_TERMS_INTRO, SPECIAL_TERMS, WARRANTY_DISCLAIMER, STANDARD_TERMS_TITLE, STANDARD_TERMS };
