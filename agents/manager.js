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
    await withTrace('Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );
      console.log(`[starting] Starting research...`);
      const searchPlan = await this._planSearches(query);
      const searchResults = await this._performSearches(searchPlan);
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Report summary\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Research complete.');

      console.log('\n\n=====REPORT=====\n\n');
      console.log(`Report: ${report.markdownReport}`);
      console.log('\n\n=====FOLLOW UP QUESTIONS=====\n\n');
      const followUpQuestions = report.followUpQuestions.join('\n');
      console.log(`Follow up questions: ${followUpQuestions}`);
    });
  }

  async performResearch(query) {
    return await withTrace('Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );
      console.log(`[starting] Starting research...`);
      const searchPlan = await this._planSearches(query);
      const searchResults = await this._performSearches(searchPlan);
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Report summary\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Research complete.');

      return {
        searchPlan,
        searchResults,
        report,
        traceId: trace.traceId,
      };
    });
  }

  async performResearchWithProgress(query, onProgress) {
    return await withTrace('Research workflow', async (trace) => {
      console.log(
        `[trace_id] View trace: https://platform.openai.com/traces/trace?trace_id=${trace.traceId}`,
      );

      onProgress('status', {
        stage: 'starting',
        message: 'Starting research...',
      });

      console.log(`[starting] Starting research...`);
      onProgress('status', {
        stage: 'planning',
        message: 'Planning searches...',
      });
      const searchPlan = await this._planSearches(query);

      onProgress('plan', {
        searchPlan,
        message: `Will perform ${searchPlan.searches.length} searches`,
      });

      const searchResults = await this._performSearchesWithProgress(
        searchPlan,
        onProgress,
      );

      onProgress('status', {
        stage: 'writing',
        message: 'Generating comprehensive report...',
      });
      const report = await this._writeReport(query, searchResults);

      const finalReport = `Report summary\n\n${report.shortSummary}`;
      console.log(`[final_report] ${finalReport}`);
      console.log('Research complete.');

      return {
        searchPlan,
        searchResults,
        report,
        traceId: trace.traceId,
      };
    });
  }

  async _planSearches(query) {
    console.log('[planning] Planning searches...');
    const result = await this.runner.run(plannerAgent, `Query: ${query}`);
    const parsed = webSearchPlan.parse(result.finalOutput);
    console.log(`[planning] Will perform ${parsed.searches.length} searches`);
    return parsed;
  }

  async _performSearches(searchPlan) {
    return await withCustomSpan(
      async (_span) => {
        console.log('[searching] Searching...');
        let numCompleted = 0;
        const tasks = searchPlan.searches.map((item) =>
          this._search(item),
        );
        const results = [];
        for await (const result of tasks) {
          if (result != null) results.push(result);
          numCompleted++;
          console.log(
            `[searching] Searching... ${numCompleted}/${tasks.length} completed`,
          );
        }
        console.log('[searching] done');
        return results;
      },
      { data: { name: 'Search the web' } },
    );
  }

  async _performSearchesWithProgress(searchPlan, onProgress) {
    return await withCustomSpan(
      async (_span) => {
        console.log('[searching] Searching...');
        let numCompleted = 0;
        const results = [];

        // Process searches sequentially to provide accurate progress
        for (let i = 0; i < searchPlan.searches.length; i++) {
          const item = searchPlan.searches[i];

          onProgress('search', {
            currentSearch: i,
            totalSearches: searchPlan.searches.length,
            searchItem: item,
            message: `Searching: ${item.query}`,
          });

          try {
            const result = await this._search(item);
            if (result != null) {
              results.push(result);
            }
            numCompleted++;

            onProgress('searchComplete', {
              currentSearch: i,
              totalSearches: searchPlan.searches.length,
              completed: numCompleted,
              message: `Completed ${numCompleted}/${searchPlan.searches.length} searches`,
            });

            console.log(
              `[searching] Searching... ${numCompleted}/${searchPlan.searches.length} completed`,
            );
          } catch (error) {
            console.error(
              `[searching] Error searching for "${item.query}":`,
              error,
            );
            onProgress('searchError', {
              currentSearch: i,
              searchItem: item,
              error: error instanceof Error ? error.message : 'Search failed',
            });
          }
        }
        console.log('[searching] done');
        return results;
      },
      { data: { name: 'Search the web' } },
    );
  }

  async _search(item) {
    const input = `Search term: ${item.query}\nReason for searching: ${item.reason}`;
    try {
      const result = await this.runner.run(searchAgent, input);
      return String(result.finalOutput);
    } catch {
      return null;
    }
  }

  async _writeReport(query, searchResults) {
    console.log('[writing] Thinking about report...');
    const input = `Original query: ${query}\nSummarized search results: ${searchResults}`;
    const result = await this.runner.run(writerAgent, input);
    // Simulate streaming updates (could be implemented with events if needed)
    console.log('[writing] done');
    return reportData.parse(result.finalOutput);
  }
}