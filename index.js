var conf = JSON.parse(fs.readFileSync("conf.json"));

var Botkit = require('botkit');
var controller = Botkit.slackbot();
var bot = controller.spawn({
  token: conf.slack_token
});
var tmp = require('tmp');
var request = require('request');
var fs = require('fs');

var framer = require('./framer.js');

var imgur = require('imgur-node-api');

imgur.setClientID(conf.imgur_client_id);


bot.startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(["keyword", "frame"],["direct_message", "direct_mention","mention"],function(bot,message) {
    // do something to respond to message
    // all of the fields available in a normal Slack message object are available
    // https://api.slack.com/events/message
    //    bot.reply(message,'You used a keyword!');
    console.log(message);

    var pattern = /(?:https?:\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi;
    var result = pattern.exec(message.text);

    if ( typeof(result) !== "undefined" ) {
        var url = result[0];
        var tmpFile = tmp.fileSync();

        request(url).
            on('end', function() {
                framer.frameIt(tmpFile.name, function(file, err) {
                    imgur.upload(file.name, function (err, res) {
                        var response = "I framed this for you: " + res.data.link;
                        console.log(res.data.link); // Log the imgur url
                        bot.reply(message, response);
                    });
                });
            }).
            pipe(fs.createWriteStream(tmpFile.name));




    }
});
