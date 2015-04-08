var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');

describe('Workflow - Variable Execution', function () {

  this.timeout(71000);

  var variableWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('variable-loop-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('variable-activity2')
        .variable('test-var-1', ['variable-activity2'], function () {
          return 1;
        })
        .variable('test-var-2', ['variable-activity2'], function (input) {
          return input._input;
        })
        .activity('variable-activity3', ['test-var-1', 'test-var-2']);

    variableWorkflow = usher
      .workflow('variable', '_test_workflow_', { taskList: 'test-variable-decision-tasklist' });

    variableWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('variable-activity1')
        .variable('test-var-1', ['variable-activity1'], function () {
          return 0;
        })
        .loop('loop1', ['test-var-1'], fragment, function () {
          return ['test1', 'test2'];
        })
        .activity('variable-activity3', ['loop1']);

    variableWorkflow.start();

    fixtures.execution.execute('variable', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    variableWorkflow.stop();
  });

  it('should execute a variable workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'variable-activity1',
      'variable-activity3');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('variable-activity1')).to.deep.equal({});
    expect(events.results('loop1-0-variable-activity2')).to.deep.equal({ 'test-var-1': 0 });
    expect(events.results('loop1-0-variable-activity3')).to.deep.equal({ 'test-var-1': 1, 'test-var-2': 'test1' });
    expect(events.results('loop1-1-variable-activity2')).to.deep.equal({ 'test-var-1': 0 });
    expect(events.results('loop1-1-variable-activity3')).to.deep.equal({ 'test-var-1': 1, 'test-var-2': 'test2' });
    expect(events.results('variable-activity3')).to.deep.equal({ 'test-var-1': 1, 'test-var-2': 'test2' });
  });

});
