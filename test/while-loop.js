var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');

describe('Workflow - While Loop Execution', function () {

  this.timeout(71000);

  var loopWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('while-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('while-activity1');

    loopWorkflow = usher
      .workflow('while', '_test_workflow_', { taskList: 'test-while-decision-tasklist' });

    loopWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .whileLoop('while1', ['activity1'], fragment, function (results) {
          return results['while-activity1'].done;
        })
        .activity('activity2', ['while1']);

    loopWorkflow.start();

    fixtures.execution.execute('while', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    loopWorkflow.stop();
  });

  it('should execute a while loop workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}} });
    expect(events.results('while1-0-while-activity1')).to.deep.equal({ done: false });
    expect(events.results('while1-1-while-activity1')).to.deep.equal({ done: false });
    expect(events.results('while1-2-while-activity1')).to.deep.equal({ done: true });
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
