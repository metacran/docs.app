var express = require('express');
var router = express.Router();

re_full = new RegExp('^/build/readme/([\\w\\.]+)$');

router.get(re_full, function(req, res) {
    var package = req.params[0];

    var open = require('amqplib').connect('amqp://localhost');

    
    res.send('OK')
	.end();
})

module.exports = router;
