var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Result', function () {

  this.timeout(71000);

  var parentWorkflow, childWorkflow, status, events;

  before(function (done) {
    parentWorkflow = usher
      .workflow('parent-result', '_test_workflow_', { taskList: 'test-parent-result-decision-tasklist' });

    parentWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .child('child1', ['activity1'], 'child-result', '1.0.0', {
          tagList: function (input) {
            return [input.activity1.activity1];
          }
        })
        .activity('activity2', ['child1']);

    childWorkflow = usher
      .workflow('child-result', '_test_workflow_', { taskList: 'test-child-result-decision-tasklist' });

    childWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .activity('activity4', ['activity3'])
        .result('result', ['activity4'], function () {
          return 'Custom result test!';
        });

    parentWorkflow.start();
    childWorkflow.start();

    fixtures.execution.execute('parent-result', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    parentWorkflow.stop();
    childWorkflow.stop();
  });

  it('should verify the result of a workflow was customized', function () {
    expect(events.childworkflow_results('child1')).to.deep.equal('Custom result test!');
  });

});
