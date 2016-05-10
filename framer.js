var gm = require('gm').subClass({imageMagick: true});
var fs = require('fs');
var _ = require('lodash');
var tmp = require('tmp');
var exec = require('child_process').execFileSync;

var frames = JSON.parse(fs.readFileSync("frames.json"));



const MIN_MATTE_MULTIPLIER = 0.97;
const MATTE_MULTIPLIER = 0.94;
const MATTE_COLOR = 'white';


/**
 * find and return a random frame from our collection of frames. we will sort/filter our list
 * by aspect ratio to try and find some that fit relatively well.
 */
var getRandomFrame = function(r) {
    var sortedFrames = _.slice(
        _.sortBy(
            _.map(frames, function(f) {
                return _.merge({ r1: f.coords[2] / f.coords[3], r2: f.coords[3] / f.coords[2] }, f);
            }),
            function(f) {
                var diff1 = Math.abs(r - f.r1);
                var diff2 = Math.abs(r - f.r2);

                if ( diff1 > diff2 ) {
                    return -1 * diff1;
                }
                return -1 * diff2;
            }),
            0, 15);

    return _.sample(sortedFrames);
};

var frameIt = function(src, cb) {
    var tmpFile = tmp.fileSync({postfix: '.jpg', keep:true});

    var frame;
    var image_id, x, y, w, h;
    var path;

    var w_mult = MIN_MATTE_MULTIPLIER;
    var h_mult = MIN_MATTE_MULTIPLIER;

    var src_height, src_width, src_is_portrait, pre_rotation, post_rotation, aspect_ratio;

    console.log("SOURCE: " + src);

    pre_rotation = 0;
    post_rotation = 0;

    //
    // 1) get dimensions of incoming image, and make some decisions about what to do with it
    //
    gm(src).identify(function (err, data) {
        if ( err ) {
            cb(undefined, err.toString());
            return;
        }

        src_width = data.size.width;
        src_height = data.size.height;

        aspect_ratio = src_width/src_height;
        console.log("aspect ratio: " + aspect_ratio);

        frame = getRandomFrame(aspect_ratio);

        image_id = frame.id;
        x = frame["coords"][0];
        y = frame["coords"][1];
        w = frame["coords"][2];
        h = frame["coords"][3];

        path = "frames/" + image_id + ".png";

        console.log(frames[image_id]);

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

        //console.log(`resize source to ${w * w_mult}, ${h * h_mult}`);

        // 3) do compositing
        console.log("let's composite");

        cmd = [
            "-compose", "dst-over",
            tmpFile.name,
            "-geometry", `+${x}+${y}`,
            path,
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


exports.getRandomFrame = getRandomFrame;
exports.frameIt = frameIt;

