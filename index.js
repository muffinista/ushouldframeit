var fs = require('fs');
var conf = JSON.parse(fs.readFileSync("conf.json"));

var Botkit = require('botkit');
var controller = Botkit.slackbot();
var bot = controller.spawn({
  token: conf.slack_token
});
var tmp = require('tmp');
var request = require('request');


var framer = require('./framer.js');

var imgur = require('imgur-node-api');

imgur.setClientID(conf.imgur_client_id);


bot.startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(["keyword", "frame"],["direct_message", "direct_mention", "mention"],function(bot,message) {
    console.log(message);

    var pattern = /(?:https?:\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi;
    var result = pattern.exec(message.text);

    if ( typeof(result) !== "undefined" ) {
        var url = result[0];
        
        // dropbox copy/paste URLs aren't to the actual file, but we can hack a path here
        if ( url.indexOf("dropbox.com") !== -1 ) {
            url = url.replace("?dl=0", "?dl=1");
        }

        var tmpFile = tmp.fileSync();

        request(url).
            on('end', function() {
                framer.frameIt(tmpFile.name, function(file, err) {
                    console.log(file);
                    console.log(err);
                    if ( typeof(err) !== "undefined" ) {
                        bot.reply(message, `Sorry, something went wrong: ${err}`);
                    }
                    else {
                        try {
                            imgur.upload(file.name, function (err, res) {
                                var response = "I framed this for you: " + res.data.link;
                                console.log(res.data.link);
                                bot.reply(message, response);
                            });
                        }
                        catch (e) {
                            bot.reply(message, `Sorry, something went wrong: ${e.toString()}`);
                        }
                    }
                });
            }).
            pipe(fs.createWriteStream(tmpFile.name));




    }
});
