/**
 *  document event bindings
 */

$(document).bind('connect', function(ev, data) {

	var port = data.port || "5280";
	var server = data.server;
	var resource = data.resource || "xmpp-httpbind";

	Xpressive.log("Connect to : http://" + server + ":" + port + "/" + resource);

	var conn = new Strophe.Connection("http://" + server + ":" + port + "/" + resource);
	// used in TEST
	//var conn = new Strophe.Connection("http://bosh.metajack.im:5280/xmpp-httpbind");

	conn.xmlInput = function(body) {
		Xpressive.show_traffic(body, 'incoming');
	};

	conn.xmlOutput = function(body) {
		Xpressive.show_traffic(body, 'outgoing');
	};
	var jid = data.myjid + "/" + data.myresource || "xprclient";

	conn.connect(jid, data.password, function(status) {
		if (status === Strophe.Status.CONNECTED) {
			Xpressive.setSettings({ "myjid": data.myjid, "myresource": data.myresource });
			$(document).trigger('on_connected');
		} else if (status === Strophe.Status.DISCONNECTED) {
			$(document).trigger('on_disconnected');
		} else if (status === Strophe.Status.DISCONNECTING) {
			Xpressive.log('Connection disconnecting.');
		} else if (status === Strophe.Status.CONNFAIL) {
			Xpressive.log('Connection failed.');
		} else if (status === Strophe.Status.ERROR) {
			Xpressive.log('Connection errored.');
		} else if (status === Strophe.Status.AUTHFAIL) {
			Xpressive.log('Authorization failed.');
		}
	});
	Xpressive.connection = conn;

	$('#chat-area').tabs('add', '#console', "Debug");
	$('#console').append("<div class='log-messages' ></div>");

	$('#client').trigger('resize');
});

$(document).bind('on_connected', function() {
	// inform the user
	Xpressive.log("Connection established.");

	$('#disconnect').removeAttr('disabled');
});

$(document).bind('on_disconnected', function() {
	$('#disconnect').attr('disabled', 'disabled');
	Xpressive.log("Connection terminated.");

	// remove dead connection object
	Xpressive.connection = null;

	$('#roster-area ul').empty();
	$('#muc-area ul').empty();
	$('#chat-area ul').empty();
	$('#chat-area div').remove();

	$('#login_dialog').dialog('open');
});

$(document).bind('roster_changed', function(ev, data) {
	Xpressive.log("Roster Changed Event.");

	Xpressive.do_roster_changed(data);
});

$(document).bind('rooms_changed', function(ev, data) {
	Xpressive.log("Rooms Changed Event.");

	Xpressive.do_rooms_changed(data);
});

$(document).bind('room_changed', function(ev, data) {
	Xpressive.log("Room Changed Event.");

	Xpressive.do_room_changed(data);
});

$(document).bind('create_room_form', function(ev, data) {
	Xpressive.log("Create Room Event.");

	Xpressive.do_create_room(data);
});

$(document).bind('presence_changed', function(ev, data) {
	Xpressive.log("Presence Changed Event.");

	Xpressive.do_presence_changed(data);
	Xpressive.do_update_info(data);
});

$(document).bind('ask_subscription', function(ev, data) {
	Xpressive.log("Subscription Request Event.");

	Xpressive.do_ask_subscription(data);
});

$(document).bind('start_chatting', function(ev, chatSession) {
	Xpressive.on_start_chat(chatSession.chatWith.jid, chatSession.name, chatSession.isGroupChat);
});

$(document).bind('join_room', function(ev, room) {
	Xpressive.on_join_room(room.jid, room.roomName, room);
});

$(document).bind('new_chat_message', function(ev, data) {
	var message = data.message;
	var fromMe = data.fromMe;
	var timestamp = data.timestamp;
	Xpressive.on_message(message, fromMe, timestamp);
});

$(document).bind('remove_contact', function(ev, contact) {
	$('#contact_dialog').dialog({ 'title' : "Confirm Remove Contact",
									'jid' : contact.jid, 
									'name' : contact.name, 
									'groups' : contact.getGroups(),
									'type' : 'remove' });
	$('#contact_dialog').dialog('open');
});

$(document).bind('modify_contact_details', function(ev, contact) {
	$('#contact_dialog').dialog({ 'title' : "Modify Contact Details",
									'jid' : contact.jid, 
									'name' : contact.name, 
									'groups' : contact.getGroups(),
									'type' : 'update' });
	$('#contact_dialog').dialog('open');
});

$(document).bind('my_status_changed', function(ev, details) {
	if (details.jid.length > 0)
		$('#my-jid').text("[" + Strophe.getBareJidFromJid(details.jid) + "]");
	$('#my-status').removeClass().addClass(details.status + " my-status");
	$('#my-status .tooltip').text(details.extendedStatusToString());
	$('#my-nickname').text(details.getNickname());
});

$(document).bind('save_settings', function(ev, newSettings) {
	Xpressive.setSettings(newSettings);
});

$(document).bind('roomname_changed', function(ev, room) {
	Xpressive.updateRoomName(room.jid, room.roomName);
});

$(document).bind('contactname_changed', function(ev, contact) {
	Xpressive.updateContactName(contact.jid, contact.name);
});

$(document).bind('destroy_room', function(ev, data) {
	Xpressive.do_destroy_room(data);	
});

$(document).bind('remove_room_from_list', function(ev, jid) {
	var jid_id = Xpressive.jid_to_id(jid);
	$('#muc-area li#' + jid_id).remove();
});

$(document).bind('confirm_action', function(ev, data) {
	Xpressive.do_confirm_action(data);	
});

$(document).bind('update_room_occupants', function(ev, occupant) {
	Xpressive.do_update_room_occupant(occupant);
});

$(document).bind('set_focus_on_tab', function(ev, jid) {
	var jid_id = Xpressive.jid_to_id(jid);
	// find the tab and 'click' it
	$('#chat-area li a[href="#chat-' + jid_id + '"]').trigger('click');
});

$(document).bind('I_have_left_room', function(ev, room) {
	Xpressive.do_clear_room_occupants(room);
});

$(document).bind('someone_has_left_room', function(ev, occupant) {
	Xpressive.do_remove_room_occupant(occupant.fullJid);
	Xpressive.do_log_chat_event("leave", {
		jid : Strophe.getBareJidFromJid(occupant.fullJid), 
		name : occupant.nickname()});
});

$(document).bind('someone_has_joined_room', function(ev, occupant) {
	Xpressive.do_log_chat_event("join", {
		jid : Strophe.getBareJidFromJid(occupant.fullJid), 
		name : occupant.nickname()});
});

$(document).bind('update_my_room_info', function(ev, info) {
	Xpressive.updateRoomData(info.jid, info.affiliation, info.role);	
});

$(document).bind('send_invitation'), function(ev, room) {
	Xpressive.do_send_invite(room);
}
