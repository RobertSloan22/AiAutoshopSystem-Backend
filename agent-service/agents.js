import { Agent, webSearchTool } from '@openai/agents';
import { z } from 'zod';

// ---- Enhanced Planner Agent ----

const plannerPrompt = `You are an expert automotive research assistant specializing in technical diagnostics and repair procedures. Given a query, create a comprehensive set of web searches to gather ALL information an automotive technician needs.

CRITICAL: Always include searches for:
1. Technical Service Bulletins (TSBs) - search "[vehicle make model year] TSB [issue]"
2. OEM repair procedures - search "[make] service manual [specific issue]" 
3. Parts identification and pricing - search "[part name] [vehicle] price availability"
4. Diagnostic procedures - search "[symptoms] diagnostic procedure [make model]"
5. Common failure patterns - search "[make model year] common [issue] problems"
6. Labor time estimates - search "[repair] labor time estimate automotive"

Focus on actionable technical information that repair shops need. Output 8-15 targeted searches that cover diagnosis, repair procedures, parts, pricing, and known issues.`;

export const webSearchItem = z.object({
  reason: z
    .string()
    .describe('Why this search is critical for the automotive diagnosis/repair process.'),
  query: z.string().describe('The targeted search term for automotive technical information.'),
  searchType: z.enum(['tsb', 'oem_guide', 'parts_pricing', 'diagnostic', 'labor_time', 'recalls', 'common_issues'])
    .describe('Type of automotive information being searched for.'),
});

export const webSearchPlan = z.object({
  searches: z
    .array(webSearchItem)
    .describe('Comprehensive list of automotive searches covering all technical aspects.'),
  estimatedDifficulty: z.enum(['routine', 'intermediate', 'complex'])
    .describe('Expected complexity of the automotive issue based on the query.'),
});

export const plannerAgent = new Agent({
  name: 'AutomotiveTechPlannerAgent',
  instructions: plannerPrompt,
  model: 'gpt-4o-mini',
  outputType: webSearchPlan,
});

// ---- Enhanced Search Agent ----

const searchAgentInstructions = `You are an automotive technical researcher with expertise in diagnostics, repair procedures, and shop operations. 

For each search, extract and summarize:

TECHNICAL INFORMATION:
- Specific diagnostic trouble codes (DTCs) and their meanings
- Step-by-step diagnostic procedures with tool requirements
- Technical Service Bulletin (TSB) numbers and details
- OEM recall information and service campaigns
- Torque specifications, fluid capacities, and technical tolerances

REPAIR PROCEDURES:
- Exact repair steps with safety warnings
- Required tools and equipment (scan tools, specialty tools)
- Labor time estimates (book time vs real-world time)
- Common complications and troubleshooting tips

PARTS & PRICING:
- OEM part numbers and aftermarket alternatives
- Current pricing from multiple suppliers (dealership, aftermarket, online)
- Availability status and lead times
- Cross-reference numbers for different suppliers

DIAGNOSTIC INDICATORS:
- What parts availability issues might indicate about root cause
- How pricing trends can reveal if this is a widespread/recall issue
- Whether expensive parts suggest looking for TSBs or warranty extensions

Focus on actionable information for working technicians. Include specific numbers, part codes, and procedures. Prioritize recent information and official sources.`;

export const searchResult = z.object({
  searchType: z.string().describe('Type of search performed'),
  summary: z.string().describe('Concise technical summary focused on repair shop needs'),
  technicalDetails: z.object({
    dtcCodes: z.array(z.string()).nullable().describe('Relevant diagnostic trouble codes'),
    partNumbers: z.array(z.string()).nullable().describe('OEM and aftermarket part numbers'),
    toolsRequired: z.array(z.string()).nullable().describe('Specific tools needed for diagnosis/repair'),
    laborTime: z.string().nullable().describe('Estimated labor time'),
    torqueSpecs: z.array(z.string()).nullable().describe('Critical torque specifications'),
  }),
  pricingInfo: z.object({
    partPrices: z.array(z.object({
      part: z.string(),
      oemPrice: z.string().nullable(),
      aftermarketPrice: z.string().nullable(),
      availability: z.string().nullable(),
    })).nullable(),
    laborEstimate: z.string().nullable().describe('Labor cost estimate'),
  }),
  bulletins: z.array(z.object({
    number: z.string(),
    description: z.string(),
    applicability: z.string(),
  })).nullable().describe('Relevant TSBs, recalls, or service campaigns'),
  sources: z.array(z.string()).describe('Key sources used for this information'),
});

export const searchAgent = new Agent({
  name: 'AutomotiveTechSearchAgent',
  instructions: searchAgentInstructions,
  tools: [webSearchTool()],
  modelSettings: { toolChoice: 'required' },
  outputType: searchResult,
});

// ---- Enhanced Writer Agent ----

const writerPrompt = `You are a master automotive technician and shop foreman writing diagnostic and repair documentation for working technicians. Your reports must be immediately actionable in a real repair shop environment.

STRUCTURE YOUR REPORT WITH THESE SECTIONS:

1. **EXECUTIVE SUMMARY** - Quick diagnosis and recommended action
2. **TECHNICAL DIAGNOSIS** - DTCs, symptoms analysis, root cause identification  
3. **TECHNICAL SERVICE BULLETINS** - Relevant TSBs, recalls, campaigns with numbers
4. **REPAIR PROCEDURES** - Step-by-step with torque specs and special tools
5. **PARTS BREAKDOWN** - OEM vs aftermarket options with current pricing
6. **LABOR & COST ANALYSIS** - Time estimates, total cost projections
7. **SHOP RECOMMENDATIONS** - Business decisions, customer communication tips
8. **QUALITY ASSURANCE** - Post-repair verification and warranty considerations

CRITICAL REQUIREMENTS:
- Include specific part numbers, TSB numbers, and DTC codes
- Provide current pricing from multiple sources (dealer, aftermarket, online)
- Explain what parts availability/pricing trends indicate about the issue
- Include safety warnings and liability considerations
- Give clear customer communication guidance for cost discussions
- Suggest upsell opportunities and related maintenance
- Address warranty implications and documentation requirements

Write for experienced technicians who need comprehensive technical details AND business guidance. Include real-world shop considerations like cycle time, comebacks, and profitability.`;

export const enhancedReportData = z.object({
  executiveSummary: z
    .string()
    .describe('2-3 sentence diagnosis and recommended action for shop foreman'),
  
  technicalDiagnosis: z.object({
    primaryIssue: z.string().describe('Root cause identification'),
    dtcCodes: z.array(z.string()).describe('All relevant diagnostic trouble codes'),
    diagnosticProcedure: z.string().describe('Step-by-step diagnostic approach'),
    commonCauses: z.array(z.string()).describe('Most likely causes ranked by probability'),
  }),

  serviceBulletins: z.array(z.object({
    bulletinNumber: z.string(),
    title: z.string(), 
    applicability: z.string(),
    summary: z.string(),
    repairProcedure: z.string().nullable(),
  })).describe('All relevant TSBs, recalls, and service campaigns'),

  partsAnalysis: z.object({
    requiredParts: z.array(z.object({
      description: z.string(),
      oemPartNumber: z.string().nullable(),
      aftermarketOptions: z.array(z.string()).nullable(),
      currentPricing: z.object({
        oemPrice: z.string().nullable(),
        aftermarketRange: z.string().nullable(), 
        bestValue: z.string().nullable(),
      }),
      availability: z.enum(['in_stock', 'special_order', 'backordered', 'discontinued']),
      leadTime: z.string().nullable(),
    })),
    totalPartsEstimate: z.string().describe('Total parts cost estimate'),
    availabilityInsights: z.string().describe('What parts availability indicates about the issue'),
  }),

  laborAnalysis: z.object({
    bookTime: z.string().describe('Standard labor time estimate'),
    realWorldTime: z.string().describe('Realistic time including complications'),
    laborRate: z.string().describe('Suggested labor rate for this type of work'),
    totalLaborEstimate: z.string(),
    difficultyFactors: z.array(z.string()).describe('Factors that may increase repair time'),
  }),

  repairProcedure: z.object({
    overview: z.string().describe('High-level repair approach'),
    detailedSteps: z.array(z.string()).describe('Step-by-step repair procedure'),
    specialTools: z.array(z.string()).describe('Required specialty tools and equipment'),
    safetyWarnings: z.array(z.string()).describe('Critical safety considerations'),
    torqueSpecifications: z.array(z.string()).describe('Important torque values'),
    qualityChecks: z.array(z.string()).describe('Post-repair verification steps'),
  }),

  businessRecommendations: z.object({
    customerCommunication: z.string().describe('How to explain the issue and costs to customer'),
    upsellOpportunities: z.array(z.string()).describe('Related services to recommend'),
    warrantyConsiderations: z.string().describe('Warranty implications and documentation needs'),
    comebackPrevention: z.string().describe('Steps to prevent customer returns'),
  }),

  markdownReport: z.string().describe('Complete formatted report for shop use'),
  
  followUpQuestions: z
    .array(z.string())
    .describe('Technical questions for additional research if needed'),
});

export const writerAgent = new Agent({
  name: 'AutomotiveShopWriterAgent', 
  instructions: writerPrompt,
  model: 'gpt-4o-mini',
  outputType: enhancedReportData,
});

// ---- Usage Example ----

export async function generateAutomotiveReport(query) {
  console.log(`🔧 Generating automotive research report for: "${query}"`);
  
  // Step 1: Plan comprehensive search strategy
  console.log('📋 Planning research strategy...');
  const searchPlan = await plannerAgent.run(query);
  
  // Step 2: Execute all searches with technical focus
  console.log(`🔍 Executing ${searchPlan.searches.length} targeted automotive searches...`);
  const searchResults = await Promise.all(
    searchPlan.searches.map(async (search) => {
      console.log(`  → Searching: ${search.query} (${search.searchType})`);
      const result = await searchAgent.run(search.query);
      return {
        searchInfo: search,
        result: result,
      };
    })
  );

  // Step 3: Synthesize into comprehensive shop report
  console.log('📊 Generating comprehensive repair shop report...');
  const reportInput = `
ORIGINAL AUTOMOTIVE QUERY: ${query}

RESEARCH RESULTS:
${searchResults.map((r, i) => `
SEARCH ${i + 1}: ${r.searchInfo.query} (${r.searchInfo.searchType})
REASONING: ${r.searchInfo.reason}
RESULTS: ${r.result}
`).join('\n')}
`;

  const finalReport = await writerAgent.run(reportInput);
  
  console.log('✅ Automotive research report complete!');
  console.log('\n📋 EXECUTIVE SUMMARY:');
  console.log(finalReport.executiveSummary);
  
  return finalReport;
}

// ---- Enhanced Configuration Options ----

export const automotiveConfig = {
  // Target automotive-specific sources
  preferredSources: [
    'alldata.com',
    'mitchell1.com', 
    'identifix.com',
    'autozone.com',
    'rockauto.com',
    'parts.toyota.com',
    'parts.honda.com',
    'parts.ford.com',
    'nhtsa.gov',
    'ase.com'
  ],
  
  // Focus areas for comprehensive coverage
  searchCategories: {
    tsb: 'Technical Service Bulletins and known issues',
    oem: 'OEM repair procedures and specifications', 
    parts: 'Parts identification, pricing, and availability',
    diagnostic: 'Diagnostic procedures and trouble codes',
    labor: 'Labor time estimates and repair complexity',
    safety: 'Safety recalls and service campaigns',
    tools: 'Required tools and equipment specifications'
  },

  // Business intelligence for shops
  businessMetrics: {
    includeProfitability: true,
    trackPartsMargin: true,
    estimateCustomerCost: true,
    flagHighValueRepairs: true,
    identifyWarrantyWork: true,
  }
};

// ---- Advanced Features for Shop Operations ----

export const diagnosticAgent = new Agent({
  name: 'DiagnosticSpecialist',
  instructions: `You are a master diagnostic technician. When given symptoms and initial data, provide:
  
  1. Systematic diagnostic tree (start here, if X then Y, if not X then Z)
  2. Most likely causes ranked by probability and cost to check
  3. Required scan tools and diagnostic equipment
  4. Time estimates for each diagnostic step
  5. When to stop diagnosing and start repairing (cost vs benefit)
  
  Focus on efficient diagnosis that maximizes shop profitability while solving customer problems.`,
  tools: [webSearchTool()],
  model: 'gpt-4o-mini',
});

export const partsSpecialist = new Agent({
  name: 'PartsAndPricingSpecialist', 
  instructions: `You are a parts specialist and inventory manager. For any automotive repair, provide:

  PARTS INTELLIGENCE:
  - OEM part numbers with current dealer pricing
  - Quality aftermarket alternatives with cost savings
  - Parts availability and lead times from major suppliers
  - Bulk discount opportunities for common repairs
  - Core charges and return policies

  BUSINESS INSIGHTS:
  - What parts shortages indicate about widespread issues
  - Pricing trends that suggest recalls or widespread problems
  - When expensive parts indicate checking for warranty extensions
  - Inventory recommendations for frequently needed items
  
  Always include markup recommendations and total customer cost projections.`,
  tools: [webSearchTool()],
  model: 'gpt-4o-mini',
});

// ---- Complete Shop Report Schema ----

export const completeShopReport = z.object({
  // Executive briefing for service advisors
  customerBriefing: z.object({
    issueExplanation: z.string().describe('How to explain the problem to customers'),
    repairJustification: z.string().describe('Why this repair is necessary'),
    costBreakdown: z.string().describe('Parts vs labor cost explanation'),
    timeframe: z.string().describe('Realistic completion timeline'),
    alternatives: z.array(z.string()).describe('Repair options if applicable'),
  }),

  // Technical details for technicians
  technicalSpecs: z.object({
    dtcCodes: z.array(z.object({
      code: z.string(),
      description: z.string(),
      likelyCause: z.string(),
      diagnosticSteps: z.array(z.string()),
    })),
    oemProcedures: z.string().describe('Official OEM repair procedure'),
    specialToolsRequired: z.array(z.object({
      tool: z.string(),
      purpose: z.string(),
      alternativeOptions: z.string().nullable(),
    })),
    torqueSpecs: z.array(z.object({
      component: z.string(),
      specification: z.string(),
      sequence: z.string().nullable(),
    })),
  }),

  // Parts and pricing intelligence
  partsIntelligence: z.object({
    primaryParts: z.array(z.object({
      component: z.string(),
      oemNumber: z.string().nullable(),
      oemPrice: z.number().nullable(),
      aftermarketOptions: z.array(z.object({
        brand: z.string(),
        partNumber: z.string(),
        price: z.number(),
        quality: z.enum(['premium', 'standard', 'economy']),
      })).nullable(),
      availability: z.enum(['in_stock', 'special_order', 'backordered', 'discontinued']),
      leadTime: z.string().nullable(),
      coreCharge: z.number().nullable(),
    })),
    
    pricingAnalysis: z.object({
      totalPartsOEM: z.number().describe('Total cost using all OEM parts'),
      totalPartsAftermarket: z.number().describe('Total cost using quality aftermarket'),
      recommendedMix: z.number().describe('Balanced cost using strategic mix'),
      markupRecommendation: z.number().describe('Suggested markup percentage'),
      customerPrice: z.number().describe('Final customer parts cost'),
    }),

    availabilityInsights: z.string().describe('What parts situation indicates about the issue'),
  }),

  // Business operations guidance
  shopOperations: z.object({
    laborEstimate: z.object({
      bookTime: z.number().describe('Standard labor hours'),
      realWorldTime: z.number().describe('Realistic time including setup/cleanup'),
      laborRate: z.number().describe('Recommended hourly rate'),
      totalLaborCost: z.number().describe('Total labor charge to customer'),
    }),
    
    profitabilityAnalysis: z.object({
      totalCustomerCost: z.number(),
      totalShopCost: z.number(), 
      grossProfit: z.number(),
      profitMargin: z.number(),
      recommendedAction: z.string().describe('Accept/decline/modify recommendation'),
    }),

    riskFactors: z.array(z.string()).describe('Potential complications or liability issues'),
    warrantyConsiderations: z.string().describe('Warranty implications and requirements'),
    upsellOpportunities: z.array(z.string()).describe('Additional services to offer'),
  }),

  // Service bulletins and recalls
  officialBulletins: z.array(z.object({
    type: z.enum(['tsb', 'recall', 'service_campaign', 'warranty_extension']),
    number: z.string(),
    title: z.string(),
    vehicles: z.string().describe('Applicable vehicles'),
    summary: z.string(),
    repairProcedure: z.string().nullable(),
    partsSupplied: z.boolean().describe('Whether manufacturer supplies parts'),
    laborReimbursement: z.string().nullable(),
  })),

  // Final formatted report
  completeReport: z.string().describe('Full markdown report ready for shop use'),
  
  // Quality assurance
  qualityChecklist: z.array(z.string()).describe('Post-repair verification steps'),
  
  // Follow-up research suggestions
  additionalResearch: z.array(z.string()).describe('Suggested follow-up research topics'),
});

export const enhancedWriterAgent = new Agent({
  name: 'MasterTechReportWriter',
  instructions: writerPrompt,
  model: 'gpt-4o-mini', 
  outputType: completeShopReport,
});

// ---- Main Enhanced Service Function ----

export async function generateComprehensiveAutomotiveReport(query) {
  console.log(`🔧 AUTOMOTIVE SHOP RESEARCH: "${query}"`);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Strategic research planning
    console.log('📋 Step 1: Planning comprehensive research strategy...');
    const searchPlan = await plannerAgent.run(query);
    console.log(`   → Planning ${searchPlan.searches.length} targeted searches`);
    console.log(`   → Estimated difficulty: ${searchPlan.estimatedDifficulty}`);
    
    // Step 2: Execute comprehensive technical research  
    console.log('\n🔍 Step 2: Executing technical research...');
    const searchResults = await Promise.all(
      searchPlan.searches.map(async (search, index) => {
        console.log(`   → Search ${index + 1}/${searchPlan.searches.length}: ${search.query}`);
        console.log(`     Type: ${search.searchType} | Reason: ${search.reason}`);
        
        try {
          const result = await searchAgent.run(search.query);
          return { searchInfo: search, result, success: true };
        } catch (error) {
          console.log(`     ⚠️  Search failed: ${error}`);
          return { searchInfo: search, result: null, success: false, error };
        }
      })
    );

    const successfulSearches = searchResults.filter(r => r.success);
    console.log(`   ✅ Completed ${successfulSearches.length}/${searchResults.length} searches`);

    // Step 3: Generate comprehensive shop report
    console.log('\n📊 Step 3: Generating comprehensive shop report...');
    
    const reportInput = `
AUTOMOTIVE REPAIR QUERY: ${query}
RESEARCH COMPLEXITY: ${searchPlan.estimatedDifficulty}

COMPREHENSIVE RESEARCH RESULTS:
${successfulSearches.map((r, i) => `
═══════════════════════════════════
RESEARCH ITEM ${i + 1}: ${r.searchInfo.query}
TYPE: ${r.searchInfo.searchType}
PURPOSE: ${r.searchInfo.reason}

TECHNICAL FINDINGS:
${JSON.stringify(r.result, null, 2)}
═══════════════════════════════════
`).join('\n')}

FAILED SEARCHES (if any):
${searchResults.filter(r => !r.success).map(r => `- ${r.searchInfo.query}: ${r.error}`).join('\n')}

Generate a comprehensive report that gives this repair shop everything they need to successfully diagnose, repair, price, and complete this automotive service while maximizing profitability and customer satisfaction.
`;

    const finalReport = await enhancedWriterAgent.run(reportInput);
    
    // Step 4: Output results for shop use
    console.log('\n✅ AUTOMOTIVE RESEARCH COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n🎯 EXECUTIVE SUMMARY:');
    console.log(finalReport.executiveSummary);
    
    console.log('\n💰 COST ANALYSIS:');
    if (finalReport.shopOperations?.profitabilityAnalysis) {
      const profit = finalReport.shopOperations.profitabilityAnalysis;
      console.log(`   Customer Cost: ${profit.totalCustomerCost}`);
      console.log(`   Shop Cost: ${profit.totalShopCost}`);
      console.log(`   Gross Profit: ${profit.grossProfit} (${profit.profitMargin}%)`);
      console.log(`   Recommendation: ${profit.recommendedAction}`);
    }

    console.log('\n📋 SERVICE BULLETINS:');
    if (finalReport.officialBulletins?.length > 0) {
      finalReport.officialBulletins.forEach(bulletin => {
        console.log(`   ${bulletin.type.toUpperCase()}: ${bulletin.number} - ${bulletin.title}`);
      });
    } else {
      console.log('   No relevant bulletins found');
    }

    return finalReport;
    
  } catch (error) {
    console.error('❌ Error generating automotive report:', error);
    throw error;
  }
}

// ---- Quick Diagnostic Function ----

export async function quickDiagnostic(symptoms, vehicle) {
  const query = `${vehicle} ${symptoms} diagnostic procedure`;
  console.log(`⚡ Quick diagnostic for: ${vehicle} with ${symptoms}`);
  
  const result = await diagnosticAgent.run(query);
  return result;
}

// ---- Parts Lookup Function ----

export async function partsLookup(partDescription, vehicle) {
  const query = `${partDescription} ${vehicle} part number price availability`;
  console.log(`🔧 Parts lookup: ${partDescription} for ${vehicle}`);
  
  const result = await partsSpecialist.run(query);
  return result;
}
