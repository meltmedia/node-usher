var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Execution', function () {

  this.timeout(71000);

  var linearWorkflow, runId, workflowId;

  before(function (done) {
    linearWorkflow = usher
      .workflow('execution-test', '_test_workflow_', { taskList: 'test-execution-test-decision-tasklist' });

    linearWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1');

    linearWorkflow.start();

    linearWorkflow.execute({ input: 'test input' }, '1.0.0', function (err, r, w) {
      runId = r;
      workflowId = w;
      setTimeout(function () {
        done(err);
      }, 5000);
    });
  });

  after(function () {
    linearWorkflow.stop();
  });

  it('should execute a workflow successfuly', function () {
    expect(runId).to.exist;
    expect(workflowId).to.exist;
  });

});
