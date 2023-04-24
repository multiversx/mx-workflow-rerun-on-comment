import { Probot } from 'probot';

export const robot = (app: Probot) => {
  app.on(
    ['issue_comment.created'],
    async (context) => {
      const body = context.payload.comment.body || '';
      const regex = process.env.REGEX;
      const name = process.env.NAME;

      console.info('body', body);
      console.info('regex', regex);
      console.info('name', name);

      let conditionValid = true;
      if (regex) {
        conditionValid = new RegExp(regex).exec(body) !== null;
      }

      if (!conditionValid) {
        return;
      }

      const workflowRuns = await context.octokit.actions.listWorkflowRunsForRepo({
        repo: context.repo().repo,
        owner: context.repo().owner,
      });

      for (const workflowRun of workflowRuns.data.workflow_runs) {
        if (workflowRun.conclusion !== 'failure') {
          continue;
        }

        const pullRequests = workflowRun.pull_requests;
        if (!pullRequests) {
          continue;
        }

        const pullRequest = pullRequests.find(x => x.number === context.pullRequest().pull_number);
        if (!pullRequest) {
          continue;
        }

        if (pullRequest.head.sha !== workflowRun.head_sha) {
          continue;
        }

        if (name && workflowRun.name !== name) {
          continue;
        }

        console.log('Rerunning', workflowRun.id);

        await context.octokit.actions.reRunWorkflowFailedJobs({
          repo: context.repo().repo,
          owner: context.repo().owner,
          run_id: workflowRun.id
        });
      }
    }
  );
};
