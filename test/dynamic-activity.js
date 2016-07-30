var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Dynamic Activity Execution', function () {

  this.timeout(71000);

  var dynamicWorkflow, status, events;

  before(function (done) {
    dynamicWorkflow = usher
      .workflow('dynamic', '_test_workflow_', { taskList: 'test-dynamic-decision-tasklist' });

    dynamicWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('test-activity', {
          activityType: function (input) {
            return {
              name: 'activity1',
              version: '1.0.0'
            };
          }
        });

    dynamicWorkflow.start();

    fixtures.execution.execute('dynamic', '1.0.0', { input: 'test input', type: 'some type' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    dynamicWorkflow.stop();
  });

  it('should execute the workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed('test-activity');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('test-activity')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input', type: 'some type'}, _variables: {}} });
  });

});
