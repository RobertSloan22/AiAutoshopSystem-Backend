import PDFProcessingService from './services/pdfProcessingService.js';

async function testPDFService() {
  console.log('Testing PDF Processing Service...\n');
  
  const pdfService = new PDFProcessingService();
  
  // Test URL - using the GM manual you provided
  const testUrl = 'https://experience.gm.com/ownercenter/content/dam/gmownercenter/gmna/dynamic/manuals/2007/cadillac/srx/2007_cadillac_srx_owners.pdf';
  
  try {
    // Test 1: Get metadata only
    console.log('Test 1: Extracting PDF metadata...');
    const metadataResult = await pdfService.processPDFFromURL(testUrl, {
      extractionMode: 'metadata'
    });
    console.log('Metadata:', JSON.stringify(metadataResult, null, 2));
    
    // Test 2: Get summary
    console.log('\nTest 2: Extracting PDF summary...');
    const summaryResult = await pdfService.processPDFFromURL(testUrl, {
      extractionMode: 'summary'
    });
    console.log('Summary preview (first 200 chars):', 
      summaryResult.content?.preview?.substring(0, 200) + '...');
    console.log('Found sections:', summaryResult.content?.sections?.length || 0);
    
    // Test 3: Search for specific terms
    console.log('\nTest 3: Searching for terms in PDF...');
    const searchResult = await pdfService.processPDFFromURL(testUrl, {
      extractionMode: 'search',
      searchTerms: ['oil change', 'tire pressure', 'engine']
    });
    
    searchResult.search_results?.forEach(result => {
      console.log(`\nFound ${result.count} matches for "${result.term}":`);
      result.matches?.slice(0, 2).forEach((match, idx) => {
        console.log(`  Match ${idx + 1}: ...${match.context}...`);
      });
    });
    
    // Test 4: Extract specific page range
    console.log('\nTest 4: Extracting pages 1-5...');
    const pageRangeResult = await pdfService.processPDFFromURL(testUrl, {
      extractionMode: 'full',
      pageRange: { start: 1, end: 5 }
    });
    console.log('Extracted text length:', pageRangeResult.content?.full_text?.length || 0);
    console.log('Number of chunks:', pageRangeResult.content?.num_chunks || 0);
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testPDFService().catch(console.error);