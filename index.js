var fs = require('fs');
var conf = JSON.parse(fs.readFileSync("conf.json"));
var tmp = require('tmp');
var request = require('request');
var framer = require('./framer.js');
var imgur = require('imgur-node-api');

var Botkit = require('botkit');

var controller = Botkit.slackbot({
    json_file_store: './frame_bot/'
}).configureSlackApp(
    {
        clientId: conf.slack_client_id,
        clientSecret: conf.slack_client_secret,
        scopes: ['bot']
    }
);


if ( conf.botkit_webserver_port ) {
    controller.setupWebserver(conf.botkit_webserver_port, function(err,webserver) {
        controller.createWebhookEndpoints(controller.webserver);

        controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
            if (err) {
                res.status(500).send('ERROR: ' + err);
            } else {
                res.send('Success!');
            }
        });
    });
}


// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });

    });
  }

});


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});


imgur.setClientID(conf.imgur_client_id);


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


controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});