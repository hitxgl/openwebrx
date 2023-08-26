function MessagePanel(el) {
    this.el = el;
    this.render();
    this.initClearButton();
}

MessagePanel.prototype.supportsMessage = function(message) {
    return false;
};

MessagePanel.prototype.render = function() {
};

MessagePanel.prototype.pushMessage = function(message) {
};

// automatic clearing is not enabled by default. call this method from the constructor to enable
MessagePanel.prototype.initClearTimer = function() {
    var me = this;
    if (me.removalInterval) clearInterval(me.removalInterval);
    me.removalInterval = setInterval(function () {
        me.clearMessages(1000);
    }, 15000);
};

MessagePanel.prototype.clearMessages = function(toRemain) {
    var $elements = $(this.el).find('tbody tr');
    // limit to 1000 entries in the list since browsers get laggy at some point
    var toRemove = $elements.length - toRemain;
    if (toRemove <= 0) return;
    $elements.slice(0, toRemove).remove();
};

MessagePanel.prototype.initClearButton = function() {
    var me = this;
    me.clearButton = $(
        '<div class="openwebrx-button">Clear</div>'
    );
    me.clearButton.css({
        position: 'absolute',
        top: '10px',
        right: '10px'
    });
    me.clearButton.on('click', function() {
        me.clearMessages(0);
    });
    $(me.el).append(me.clearButton);
};

MessagePanel.prototype.htmlEscape = function(input) {
    return $('<div/>').text(input).html()
}

function WsjtMessagePanel(el) {
    MessagePanel.call(this, el);
    this.initClearTimer();
    this.qsoModes = ['FT8', 'JT65', 'JT9', 'FT4', 'FST4', 'Q65', 'MSK144'];
    this.beaconModes = ['WSPR', 'FST4W'];
    this.modes = [].concat(this.qsoModes, this.beaconModes);
}

WsjtMessagePanel.prototype = new MessagePanel();

WsjtMessagePanel.prototype.supportsMessage = function(message) {
    return this.modes.indexOf(message['mode']) >= 0;
};

WsjtMessagePanel.prototype.render = function() {
    $(this.el).append($(
        '<table>' +
            '<thead><tr>' +
                '<th>UTC</th>' +
                '<th class="decimal">dB</th>' +
                '<th class="decimal">DT</th>' +
                '<th class="decimal freq">Freq</th>' +
                '<th class="message">Message</th>' +
            '</tr></thead>' +
            '<tbody></tbody>' +
        '</table>'
    ));
};

WsjtMessagePanel.prototype.pushMessage = function(msg) {
    var $b = $(this.el).find('tbody');
    var t = new Date(msg['timestamp']);
    var pad = function (i) {
        return ('' + i).padStart(2, "0");
    };
    var linkedmsg = msg['msg'];
    var matches;

    if (this.qsoModes.indexOf(msg['mode']) >= 0) {
        matches = linkedmsg.match(/(.*\s[A-Z0-9]+\s)([A-R]{2}[0-9]{2})$/);
        if (matches && matches[2] !== 'RR73') {
            linkedmsg = this.htmlEscape(matches[1]) + '<a href="map?locator=' + matches[2] + '" target="openwebrx-map">' + matches[2] + '</a>';
        } else {
            linkedmsg = this.htmlEscape(linkedmsg);
        }
    } else if (this.beaconModes.indexOf(msg['mode']) >= 0) {
        matches = linkedmsg.match(/([A-Z0-9]*\s)([A-R]{2}[0-9]{2})(\s[0-9]+)/);
        if (matches) {
            linkedmsg = this.htmlEscape(matches[1]) + '<a href="map?locator=' + matches[2] + '" target="openwebrx-map">' + matches[2] + '</a>' + this.htmlEscape(matches[3]);
        } else {
            linkedmsg = this.htmlEscape(linkedmsg);
        }
    }
    $b.append($(
        '<tr data-timestamp="' + msg['timestamp'] + '">' +
        '<td>' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds()) + '</td>' +
        '<td class="decimal">' + msg['db'] + '</td>' +
        '<td class="decimal">' + msg['dt'] + '</td>' +
        '<td class="decimal freq">' + msg['freq'] + '</td>' +
        '<td class="message">' + linkedmsg + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
}

$.fn.wsjtMessagePanel = function(){
    if (!this.data('panel')) {
        this.data('panel', new WsjtMessagePanel(this));
    }
    return this.data('panel');
};

function PacketMessagePanel(el) {
    MessagePanel.call(this, el);
    this.initClearTimer();
}

PacketMessagePanel.prototype = new MessagePanel();

PacketMessagePanel.prototype.supportsMessage = function(message) {
    return message['mode'] === 'APRS';
};

PacketMessagePanel.prototype.render = function() {
    $(this.el).append($(
        '<table>' +
            '<thead><tr>' +
                '<th>UTC</th>' +
                '<th class="callsign">Callsign</th>' +
                '<th class="coord">Coord</th>' +
                '<th class="message">Comment</th>' +
            '</tr></thead>' +
            '<tbody></tbody>' +
        '</table>'
    ));
};

PacketMessagePanel.prototype.pushMessage = function(msg) {
    var $b = $(this.el).find('tbody');
    var pad = function (i) {
        return ('' + i).padStart(2, "0");
    };

    if (msg.type && msg.type === 'thirdparty' && msg.data) {
        msg = msg.data;
    }

    var source = msg.source;
    var callsign;
    if ('object' in source) {
        callsign = source.object;
    } else if ('item' in source) {
        callsign = source.item;
    } else {
        callsign = source.callsign;
        if ('ssid' in source) {
            callsign += '-' + source.ssid;
        }
    }

    var timestamp = '';
    if (msg.timestamp) {
        var t = new Date(msg.timestamp);
        timestamp = pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds())
    }

    var link = '';
    var classes = [];
    var styles = {};
    var overlay = '';
    var stylesToString = function (s) {
        return $.map(s, function (value, key) {
            return key + ':' + value + ';'
        }).join('')
    };
    if (msg.symbol) {
        classes.push('aprs-symbol');
        classes.push('aprs-symboltable-' + (msg.symbol.table === '/' ? 'normal' : 'alternate'));
        styles['background-position-x'] = -(msg.symbol.index % 16) * 15 + 'px';
        styles['background-position-y'] = -Math.floor(msg.symbol.index / 16) * 15 + 'px';
        if (msg.symbol.table !== '/' && msg.symbol.table !== '\\') {
            var s = {};
            s['background-position-x'] = -(msg.symbol.tableindex % 16) * 15 + 'px';
            s['background-position-y'] = -Math.floor(msg.symbol.tableindex / 16) * 15 + 'px';
            overlay = '<div class="aprs-symbol aprs-symboltable-overlay" style="' + stylesToString(s) + '"></div>';
        }
    } else if (msg.lat && msg.lon) {
        classes.push('openwebrx-maps-pin');
        overlay = '<svg viewBox="0 0 20 35"><use xlink:href="static/gfx/svg-defs.svg#maps-pin"></use></svg>';
    }
    var attrs = [
        'class="' + classes.join(' ') + '"',
        'style="' + stylesToString(styles) + '"'
    ].join(' ');
    if (msg.lat && msg.lon) {
        link = '<a ' + attrs + ' href="map?' + new URLSearchParams(source).toString() + '" target="openwebrx-map">' + overlay + '</a>';
    } else {
        link = '<div ' + attrs + '>' + overlay + '</div>'
    }

    $b.append($(
        '<tr>' +
        '<td>' + timestamp + '</td>' +
        '<td class="callsign">' + callsign + '</td>' +
        '<td class="coord">' + link + '</td>' +
        '<td class="message">' + this.htmlEscape(msg.comment || msg.message || '') + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
};

$.fn.packetMessagePanel = function() {
    if (!this.data('panel')) {
        this.data('panel', new PacketMessagePanel(this));
    }
    return this.data('panel');
};

PocsagMessagePanel = function(el) {
    MessagePanel.call(this, el);
    this.initClearTimer();
}

PocsagMessagePanel.prototype = new MessagePanel();

PocsagMessagePanel.prototype.supportsMessage = function(message) {
    return message['mode'] === 'Pocsag';
};

PocsagMessagePanel.prototype.render = function() {
    $(this.el).append($(
        '<table>' +
            '<thead><tr>' +
                '<th class="address">Address</th>' +
                '<th class="message">Message</th>' +
            '</tr></thead>' +
            '<tbody></tbody>' +
        '</table>'
    ));
};

PocsagMessagePanel.prototype.pushMessage = function(msg) {
    var $b = $(this.el).find('tbody');
    $b.append($(
        '<tr>' +
            '<td class="address">' + msg.address + '</td>' +
            '<td class="message">' + this.htmlEscape(msg.message) + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
};

$.fn.pocsagMessagePanel = function() {
    if (!this.data('panel')) {
        this.data('panel', new PocsagMessagePanel(this));
    }
    return this.data('panel');
};

AdsbMessagePanel = function(el) {
    MessagePanel.call(this, el);
    this.aircraft = {}
    this.initClearTimer();
}

AdsbMessagePanel.prototype = new MessagePanel();

AdsbMessagePanel.prototype.supportsMessage = function(message) {
    return message["mode"] === "ADSB";
};

AdsbMessagePanel.prototype.render = function() {
    $(this.el).append($(
        '<table>' +
            '<thead><tr>' +
                '<th class="address">ICAO</th>' +
                '<th class="callsign">Callsign</th>' +
                '<th class="altitude">Altitude</th>' +
                '<th class="speed">Speed</th>' +
                '<th class="track">Track</th>' +
                '<th class="verticalspeed">V/S</th>' +
                '<th class="lat">Lat</th>' +
                '<th class="lon">Long</th>' +
                '<th class="messages">Messages</th>' +
            '</tr></thead>' +
            '<tbody></tbody>' +
        '</table>'
    ));
};


AdsbMessagePanel.prototype.pushMessage = function(message) {
    if (!('icao' in message)) return;
    if (!(message.icao in this.aircraft)) {
        var el = $("<tr>");
        $(this.el).find('tbody').append(el);
        this.aircraft[message.icao] = {
            el: el,
            messages: 0
        }
    }
    var state = this.aircraft[message.icao];
    Object.assign(state, message);
    state.lastSeen = Date.now();
    state.messages += 1;

    var ifDefined = function(input, formatter) {
        if (typeof(input) !== 'undefined') {
            if (formatter) return formatter(input);
            return input;
        }
        return "";
    }

    var coordRound = function(i) {
        return Math.round(i * 1000) / 1000;
    }

    state.el.html(
        '<td><a href="map?icao=' + state.icao + '" target="openwebrx-map">' + state.icao + '</a></td>' +
        '<td>' + ifDefined(state.identification) + '</td>' +
        '<td>' + ifDefined(state.altitude) + '</td>' +
        '<td>' + ifDefined(state.groundspeed || state.IAS || state.TAS, Math.round) + '</td>' +
        '<td>' + ifDefined(state.groundtrack || state.heading, Math.round) + '</td>' +
        '<td>' + ifDefined(state.verticalspeed) + '</td>' +
        '<td>' + ifDefined(state.lat, coordRound) + '</td>' +
        '<td>' + ifDefined(state.lon, coordRound) + '</td>' +
        '<td>' + state.messages + '</td>'
    );
};

AdsbMessagePanel.prototype.clearMessages = function(toRemain) {
    var now = Date.now();
    var me = this;
    Object.entries(this.aircraft).forEach(function(e) {
        if (now - e[1].lastSeen > toRemain) {
            delete me.aircraft[e[0]];
            e[1].el.remove();
        }
    })
};

AdsbMessagePanel.prototype.initClearTimer = function() {
    var me = this;
    if (me.removalInterval) clearInterval(me.removalInterval);
    me.removalInterval = setInterval(function () {
        me.clearMessages(30000);
    }, 15000);
};


$.fn.adsbMessagePanel = function () {
    if (!this.data('panel')) {
        this.data('panel', new AdsbMessagePanel(this));
    }
    return this.data('panel');
};