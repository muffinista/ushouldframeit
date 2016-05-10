var framer = require('./framer.js');
var argv = require('minimist')(process.argv.slice(2));
var src = argv._[0];

framer.frameIt(src, function(result) {
    console.log(result.name);
});
