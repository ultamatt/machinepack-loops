module.exports = {
  friendlyName: 'Map',
  description: 'Iterate over each item of an array to build a new transformed array.',
  extendedDescription: '',
  inputs: {
    array: {
      description: 'The array to loop over',
      typeclass: 'array',
      required: true
    },
    worker: {
      description: 'The machine to run on each item in the array.',
      extendedDescription: 'Expects machine to have a single (typeclass: "*") input called "value", and two exits: "success" and "error".',
      typeclass: 'machine',
      required: true
    },
    data: {
      description: 'Optional data param for the worker',
      extendedDescription: 'Use this to pass other data and options to the worker besides the array item',
      example: '*'
    },
    series: {
      description: 'Whether to run worker on one item at a time (in series)',
      extendedDescription: 'By default, all items are run at the same time (in parallel)',
      example: false,
      defaultsTo: false
    },
  },
  defaultExit: 'success',
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    success: {
      friendlyName: 'then',
      description: 'Returns a new array of the same length, but possibly with transformed values.',
      getExample: function (inputs, env) {
        var _ = require('lodash');

        // Look up the first item in the array
        var firstItemInArray = inputs.array && inputs.array.length && inputs.array[0] || {};

        // Build up input values to use in the worker
        var firstWorkerInputName = _.keys(inputs.worker)[0];
        var secondWorkerInputName = _.keys(inputs.worker)[1];
        var workerInputTuple = (function(){
          var vals = {};
          vals[firstWorkerInputName] = firstItemInArray;
          if (secondWorkerInputName && !_.isUndefined(inputs.data)) {
              vals[secondWorkerInputName] = inputs.data;
          }
          return vals;
        })();

        // Get the example (using getExample() if necessary) of the success exit of the worker.
        var defaultExit = (function() {
          if (inputs.worker.exits.success) {return inputs.worker.exits.success;}
          var exit = _.find(inputs.worker.exits, {__varName__: 'success'});
          if (exit) {return exit;}
          exit = _.find(inputs.worker.exits, {exitName: 'success'});
          if (exit) {return exit;}
          return _.values(inputs.worker.exits)[0];
        })();
        var defaultExitExample = (function (){
          // If `getExample()` is defined, call it using the first item of the array.
          if (_.isFunction(defaultExit.getExample)) {
            return defaultExit.getExample(workerInputTuple, env);
          }
          // Tolerate missing example/getExample by returning early (`undefined` exit example is "contagious")
          return defaultExit.example;
        })();

        // Return the worker's default exit's example, wrapped in an array.
        return [defaultExitExample];
      }
    }
  },
  fn: function (inputs,exits,env) {

    var async = require('async');

    // Get the name of the first input to the worker
    // TODO: replace this with "typeclass: machine" type checking
    if (!inputs.worker.inputs || typeof inputs.worker.inputs != 'object') {
      return exits.error("Worker misconfigured: no inputs object found");
    }
    var workerInputs = Object.keys(inputs.worker.inputs);
    if (workerInputs.length === 0) {
      return exits.error("Worker misconfigured: inputs object empty");
    }
    var loop = inputs.series ? async.mapSeries : async.map;
    loop(inputs.array, function(item, cb) {
      var config = {};
      config[workerInputs[0]] = item;
      if (inputs.data && workerInputs.length > 1) {
          config[workerInputs[1]] = inputs.data;
      }
      inputs.worker(config).setEnvironment(env).exec(function(err, output) {
          if (err && err.exit && err.exit.indexOf('success') === 0) {return cb(null, err.output);}
          if (err) {return cb(err);}
          return cb(null, output);
      });
    }, exits);

  },

};
