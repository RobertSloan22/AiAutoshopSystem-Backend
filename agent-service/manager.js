import { withCustomSpan, withTrace } from '@openai/agents';
import {
  plannerAgent,
  webSearchPlan,
  searchAgent,
  writerAgent,
  reportData,
} from './agents.js';
import { Runner } from '@openai/agents';

export class ResearchManager {
  constructor(runner = new Runner()) {
    this.runner = runner;
  }

  async run(query) {
    return await withTrace('Automotive Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );
      console.log(`[starting] Starting automotive research...`);
      const searchPlan = await this._planSearches(query);
      const searchResults = await this._performSearches(searchPlan);
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Automotive Research Report\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Automotive research complete.');

      return {
        searchPlan,
        searchResults,
        report,
        traceId: trace.traceId,
        success: true,
        message: 'Research completed successfully'
      };
    });
  }

  async performResearch(query) {
    return await withTrace('Automotive Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );
      console.log(`[starting] Starting automotive research...`);
      const searchPlan = await this._planSearches(query);
      const searchResults = await this._performSearches(searchPlan);
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Automotive Research Report\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Automotive research complete.');

      return {
        searchPlan,
        searchResults,
        report,
        traceId: trace.traceId,
        success: true,
        message: 'Research completed successfully',
        result: report, // Send the full report object
        sources: searchResults.map((result, index) => ({
          id: index + 1,
          query: searchPlan.searches[index]?.query || `Search ${index + 1}`,
          summary: result
        }))
      };
    });
  }

  async performResearchWithProgress(query, onProgress) {
    return await withTrace('Automotive Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );

      onProgress?.('status', {
        stage: 'starting',
        message: 'Starting automotive research...',
      });

      console.log(`[starting] Starting automotive research...`);
      onProgress?.('status', {
        stage: 'planning',
        message: 'Planning automotive research searches...',
      });
      const searchPlan = await this._planSearches(query);

      onProgress?.('plan', {
        searchPlan,
        message: `Will perform ${searchPlan.searches.length} automotive searches`,
      });

      const searchResults = await this._performSearchesWithProgress(
        searchPlan,
        onProgress,
      );

      onProgress?.('status', {
        stage: 'writing',
        message: 'Generating comprehensive automotive repair report...',
      });
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Automotive Research Report\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Automotive research complete.');

      return {
        searchPlan,
        searchResults,
        report,
        traceId: trace.traceId,
        success: true,
        message: 'Research completed successfully',
        result: report, // Send the full report object
        sources: searchResults.map((result, index) => ({
          id: index + 1,
          query: searchPlan.searches[index]?.query || `Search ${index + 1}`,
          summary: result
        }))
      };
    });
  }

  async _planSearches(query) {
    console.log('[planning] Planning automotive searches...');
    const result = await this.runner.run(plannerAgent, `Automotive Query: ${query}`);
    const parsed = webSearchPlan.parse(result.finalOutput);
    console.log(`[planning] Will perform ${parsed.searches.length} automotive searches`);
    return parsed;
  }

  async _performSearches(searchPlan) {
    return await withCustomSpan(
      async (_span) => {
        console.log('[searching] Searching automotive information...');
        let numCompleted = 0;
        const tasks = searchPlan.searches.map((item) =>
          this._search(item),
        );
        const results = [];
        for await (const result of tasks) {
          if (result != null) results.push(result);
          numCompleted++;
          console.log(
            `[searching] Automotive searching... ${numCompleted}/${tasks.length} completed`,
          );
        }
        console.log('[searching] Automotive searches done');
        return results;
      },
      { data: { name: 'Search automotive information' } },
    );
  }

  async _performSearchesWithProgress(searchPlan, onProgress) {
    return await withCustomSpan(
      async (_span) => {
        console.log('[searching] Searching automotive information...');
        let numCompleted = 0;
        const results = [];

        // Process searches sequentially to provide accurate progress
        for (let i = 0; i < searchPlan.searches.length; i++) {
          const item = searchPlan.searches[i];

          onProgress?.('search', {
            currentSearch: i,
            totalSearches: searchPlan.searches.length,
            searchItem: item,
            message: `Searching automotive info: ${item.query}`,
          });

          try {
            const result = await this._search(item);
            if (result != null) {
              results.push(result);
            }
            numCompleted++;

            onProgress?.('searchComplete', {
              currentSearch: i,
              totalSearches: searchPlan.searches.length,
              completed: numCompleted,
              message: `Completed ${numCompleted}/${searchPlan.searches.length} automotive searches`,
            });

            console.log(
              `[searching] Automotive searching... ${numCompleted}/${searchPlan.searches.length} completed`,
            );
          } catch (error) {
            console.error(
              `[searching] Error searching automotive info for "${item.query}":`,
              error,
            );
            onProgress?.('searchError', {
              currentSearch: i,
              searchItem: item,
              error: error instanceof Error ? error.message : 'Automotive search failed',
            });
          }
        }
        console.log('[searching] Automotive searches done');
        return results;
      },
      { data: { name: 'Search automotive information' } },
    );
  }

  async _search(item) {
    const input = `Automotive search term: ${item.query}\nReason for searching: ${item.reason}`;
    try {
      const result = await this.runner.run(searchAgent, input);
      return String(result.finalOutput);
    } catch {
      return null;
    }
  }

  async _writeReport(query, searchResults) {
    console.log('[writing] Writing automotive repair report...');
    const input = `Original automotive query: ${query}\nAutomotive research results: ${searchResults}`;
    const result = await this.runner.run(writerAgent, input);
    console.log('[writing] Automotive report complete');
    return reportData.parse(result.finalOutput);
  }
}