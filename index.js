var program = require('commander');
var request = require('request');
var fs = require('fs');

program.option('-p --phone <phone_number>', 'Phone Number');
program.option('-t --otp <otp>', 'One-Time-Passcode');
program.option('-h --heartbeat <seconds>', 'Heartbeat Time (how often yaks are grabbed)', 10)

program.parse(process.argv);

var inputPhone = program.phone;
var inputOTP = program.otp;

var cookieJar = request.jar();

var init = function(accessToken) {
    console.log('Starting timer - every 10s')

    setInterval(function() {
        gatherYaks(accessToken);
    }, program.heartbeat * 1000);

    gatherYaks(accessToken); // fire it off once at the beginning
};

var gatherYaks = function(accessToken) {
    request({
        url: 'https://www.yikyak.com/api/proxy/v1/messages/all/new?userLat=39.4928235&userLong=-74.5596879&lat=39.4928235&long=-74.5596879&myHerd=0',
        method: 'GET',
        headers: {
            'x-access-token': accessToken,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.82 Safari/537.36',
            'Referer': 'https://www.yikyak.com/nearby/new'
        },
        json: true
    }, (err, response, body) => {
        var accessToken = body;
        processYaks(body);
    })
}

var MESSAGES = {};

var processYaks = function(yaks) {
    var boiled = yaks.map((y) => { return {
        id: y.messageID,
        msg: y.message,
        coords: {
            lat: y.latitude,
            lng: y.longitude
        },
        time: y.time,
        nickname: y.nickname
    }});

    try {
        // much atomic
        var MESSAGES = {};
        try {
            var MESSAGES = JSON.parse(fs.readFileSync('./scrape.json'));
        } catch(e) {
            console.log('No scrape.json found - probably going to create a new one here ina sec...')
        }

        var newMessages = 0;
        boiled.forEach(function(msg) {
            if (!MESSAGES[msg.id]) {
                MESSAGES[msg.id] = msg;
                newMessages++;
            }
        });

        console.log('Found %d new messages', newMessages);

        fs.writeFileSync('./scrape.json', JSON.stringify(MESSAGES, null, 2));

    } catch(e) {
        console.log(e);
    }
}

if (inputPhone && inputOTP) {
    // do our authorization
    request({
        url: 'https://www.yikyak.com/api/auth/pair',
        method: 'POST',
        headers: {
            'x-access-token': 'undefined',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.82 Safari/537.36',
            'Referer': 'https://www.yikyak.com/login',
            'Origin': 'https://www.yikyak.com'
        },
        json: {
            countryCode: 'USA',
            phoneNumber: inputPhone.toString(),
            pin: inputOTP.toString()
        }
    }, (err, response, body) => {
        fs.writeFileSync('./accesstoken.txt', body);
        init(body);
    });
} else {
    try {
        var token = fs.readFileSync('./accesstoken.txt');
        if (token.length > 0) {
            init(token);
        }
    } catch(e) {
        console.error(e);
        console.log('----------------------------');
        console.log('No access token saved. Start the app w/ the following args:\n\tnode index.js -p <phone> -t <token>');
        process.exit();
    }
}
