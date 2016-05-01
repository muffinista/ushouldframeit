var gm = require('gm').subClass({imageMagick: true});
var fs = require('fs');
var _ = require('lodash');
var tmp = require('tmp');
var exec = require('child_process').execFileSync;

var frames = JSON.parse(fs.readFileSync("frames.json"));
var frame_ids = _.keys(frames);
const MATTE_MULTIPLIER = 0.95;
const MATTE_COLOR = 'white';


var frameIt = function(src, cb) {
    var tmpFile = tmp.fileSync({postfix: '.jpg', keep:true});

    console.log(tmpFile);

    //# random image frame
    var image_id = _.sample(frame_ids);
    console.log(frames[image_id]);
    var x = frames[image_id]["coords"][0];
    var y = frames[image_id]["coords"][1];
    var w = frames[image_id]["coords"][2];
    var h = frames[image_id]["coords"][3];

    var path = image_id + ".png";

    var w_mult = 1.0;
    var h_mult = 1.0;


    console.log(`use image ${image_id} ${x} ${y} ${w} ${h}`);


    // 4) optionally rotate output

    var src_height, src_width, src_is_portrait, pre_rotation, post_rotation;

    pre_rotation = 0;
    post_rotation = 0;

    //
    // 1) get dimensions of incoming image, and make some decisions about what to do with it
    //
    gm(src).identify(function (err, data) {
        src_width = data.size.width;
        src_height = data.size.height;

        if ( src_width > src_height ) {
            w_mult = MATTE_MULTIPLIER;
        }
        else if ( src_height > src_width ) {
            h_mult = MATTE_MULTIPLIER;
        }

        src_is_portrait = ( src_height > src_width ) ? true : false;

        pre_rotation = 0;
        post_rotation = 0;
        if ( src_is_portrait === true ) {
            console.log("rotate source to match frame math");
            pre_rotation = 90;
            post_rotation = 270;
        }


        // resize the source image to fit into the frame. add a little whitespace
        var cmd = [
            src,
            '-rotate', pre_rotation,
            '-resize', `${w*w_mult}x${h*h_mult}`,
            '-background', MATTE_COLOR,
            "-gravity", "center",
            '-extent', `${w}x${h}`,
            tmpFile.name];

        console.log(cmd);
        exec('convert', cmd);

        console.log(`resize source to ${w * w_mult}, ${h * h_mult}`);

        // 3) do compositing
        console.log("let's composite");

        cmd = [
            "-compose", "dst-over",
            tmpFile.name,
            "-geometry", `+${x}+${y}`,
            `${image_id}.png`,
            tmpFile.name];

        console.log(cmd.join(' '));
        exec('composite', cmd);


        if ( post_rotation !== 0 ) {
            console.log("rotate final output");
            cmd = [
                tmpFile.name,
                '-rotate', post_rotation,
                tmpFile.name];

            console.log(cmd);
            exec('convert', cmd);
        }

        cb(tmpFile, undefined);
    });

};



exports.frameIt = frameIt;