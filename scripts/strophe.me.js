function Me() {
	this.jid = "";
	this.password = "";
	this.status = "";
}

Me.prototype.setStatus = function(newStatus) {
	if (this.status === newStatus)
		return;
	this.status = newStatus;
	$(document).trigger('status_changed', this);
};

Strophe.addConnectionPlugin('me', (function() {
	var _connection = null, myDetails = {};

	var init = function(connection) {
		Strophe.debug("init me plugin");

		this._connection = connection;
		this.myDetails = new Me();
		this._connection.addHandler(_onVersionIq.bind(this), Strophe.NS.VERSION, 'iq', 'get', null, null);
		this._this = this;
	};

	var statusChanged = function(status) {
		switch (status) {
			case Strophe.Status.CONNECTED :
				this.myDetails.jid = this._connection.jid;
				this.myDetails.setStatus("connected");
				this._connection.disco.addFeature(Strophe.NS.VERSION);
				break;
			case Strophe.Status.CONNECTING :
				this.myDetails.setStatus("connecting");
				break;
			case Strophe.Status.DISCONNECTING :
				this.myDetails.setStatus("disconnecting");
				break;
			case Strophe.Status.DISCONNECTED :
				this.myDetails.setStatus("disconnected");
				break;
			case Strophe.Status.CONNFAIL :
				this.myDetails.setStatus("connfail");
				break;
			case Strophe.Status.AUTHENTICATING :
				this.myDetails.setStatus("authenticating");
				break;
			case Strophe.Status.AUTHFAIL:
				this.myDetails.setStatus("authfail");
				break;
		}
	};

	var _onVersionIq = function(iq) {
		var stanza = $(iq);

		var id = stanza.attr('id');
		var from = stanza.attr('from');
		var iqresult = $iq({
			to : from,
			type : 'result',
			id : id
		});

		iqresult.c('query', {
			xmlns : Strophe.NS.VERSION
		}).c('name', null, 'XpressiveJS').c('version', null, '0.1');

		this._connection.send(iqresult.tree());
		return true;
	};

	var myJid = function() {
		return Strophe.getBareJidFromJid(this.myDetails.jid);	
	};
	
	var available = function() {
		if (this.myDetails.status === "") {
			this._connection.caps.sendPres();
		} else {
			this._connection.send($pres().tree());
		}
		this.myDetails.setStatus("available");
	};

	var away = function() {
		this.myDetails.setStatus("away");
		_sendPres('away');
	};

	var chat = function() {
		this.myDetails.setStatus("chat");
		_sendPres('chat');
	};

	var xa = function() {
		this.myDetails.setStatus("xa");
		_sendPres('xa');
	};

	var dnd = function() {
		this.myDetails.setStatus("dnd");
		_sendPres('dnd');
	};

	var offline = function() {
		this.myDetails.setStatus("unavailable");
		this._connection.send($pres({
			type : "unavailable"
		}).tree());
	};

	var _sendPres = function(show) {
		if (this._connection !== undefined) {
			this._connection.send($pres().c('show', null, show).tree());
		}
	};
	
	return {
		init : init,
		statusChanged : statusChanged,
		available : available,
		away : away,
		chat : chat,
		xa : xa,
		dnd : dnd,
		offline : offline,
		myJid : myJid
	};
})());
