/**
 * @author Robert Taylor
 */

$(document).ready(function() {
	var listShowing = "Contacts";

	/** 
	 * TODO: CLICK EVENT HANDLERS
	 */

	$(document).on('click', '#settings', function() {
		var settings = Xpressive.getSettings();
		$('#settings_dialog').dialog(settings);
		$('#settings_dialog').dialog('open');
	});

	$(document).on('click', '.my-status', function() {
		var classList = $('#my-status').attr('class').split(/\s+/);
		classList.forEach( function(className) {
			if (className !== 'my-status') {
				switch (className){
					case 'available':
					case 'away':
					case 'xa':
					case 'chat':
					case 'dnd':
					case 'unavailable':
						$('#status_dialog').dialog('option', 'currentStatus', className);
						$('#status_dialog').dialog('open');
						break;

					case 'connecting':
					case 'connected':
					case 'authenticating':
					case 'disconnecting':
					case 'disconnected':
						break;

					case 'connfail':
					case 'authfail':
						break;
				}
				return;
			}
		});	
	});

	$(document).on('click', '.xmpp-chat-to-dlg', function() {
		$('#chat_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-destroy-room', function(ev) {

		ev.stopPropagation();
		
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		var name = Xpressive.mucGetRoom(jid).roomName;
		
		var dialogData = {
			"title" : "Delete Room",
			"message" : "You are about to delete room :<br/> <b>" + name + "</b><br/>Please confirm you action.",
			"onOk" : function(reason, altRoomJid, altRoomPassword, userData) {
				Strophe.info("Action: Destroy Room ["+ jid +"] confirmed.");
				Xpressive.mucDestroyRoom(jid, reason, altRoomJid, altRoomPassword);
			},
			"onCancel" : function() {
				Strophe.info("Action: Destroy Room ["+ jid +"] cancelled.");
				return;
			},
			"userData" : { "roomJid" : jid }
		};
		
		$(document).trigger('destroy_room', dialogData);
	});

	$(document).on('click', '.xmpp-change-details', function(ev) {

		ev.stopPropagation();
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();

		var contact = Xpressive.rosterFindContact(jid);
		$(document).trigger('modify_contact_details', contact);
	});

	$(document).on('click', '.xmpp-remove-contact', function(ev) {

		ev.stopPropagation();
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();

		var contact = Xpressive.rosterFindContact(jid);
		$(document).trigger('remove_contact', contact);
	});

	$(document).on('click', '.xmpp-chat-to', function(ev) {

		ev.stopPropagation();
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();

		Xpressive.rosterChatTo(jid);
	});

	$(document).on('click', '.room-name, .room-jid', function(ev) {
		
		ev.stopPropagation();
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();

		$('#roomDetails_dialog').dialog('option', 'roomJid', jid);
		$('#roomDetails_dialog').dialog('open');
	});
	
	$(document).on('click', '.xmpp-join-room', function(ev) {
		
		ev.stopPropagation();		
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		var room = Xpressive.mucGetRoom(jid);
		if (room.chatSession) {
			room.join();
			return;
		}
		var secure = room.requiresPassword();		
		var title = "Join: " + room.roomName;

		$('#joinRoom_dialog').dialog({ 'title' : title, 
										'secure' : secure, 
										'jid' : jid });
		$('#joinRoom_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-refresh-room', function(ev) {
		
		ev.stopPropagation();		
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		Xpressive.mucRefreshInfo(jid);
	});
	
	$(document).on('click', '.xmpp-configure-room', function(ev) {
		
		ev.stopPropagation();		
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		Xpressive.mucConfigureRoom(jid);
	});
	
	$(document).on('click', '.xmpp-new-room', function(ev) {

		ev.stopPropagation();
		// request room name & nickname
		$('#createRoom_dialog').dialog('option', 'nickname', Xpressive.meGetMyNickname());
		$('#createRoom_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-add-contact', function(ev) {
		
		ev.stopPropagation();
		$('#contact_dialog').dialog({ 'title' : "Add New Contact",
									  'jid' : "@taylor-home.com", 
									  'name' : "", 
									  'groups' : "", 
									  'type' : "add" });
		$('#contact_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-affil-actions', function(ev) {

		ev.stopPropagation();
		var $tab = $(this).parents('div.ui-tabs-panel');
		var jid = $tab.data('jid');
		var name = $tab.data('name');
		var resource = $tab.data('resource');
		
		Xpressive.log("xmpp-affil-actions:" + jid + "/" + name + "/" + resource);		
	});

	$(document).on('click', '.xmpp-role-actions', function(ev) {

		ev.stopPropagation();
		var $tab = $(this).parents('div.ui-tabs-panel');
		var jid = $tab.data('jid');
		var name = $tab.data('name');
		var resource = $tab.data('resource');

		Xpressive.log("xmpp-role-actions:" + jid + "/" + name + "/" + resource);
	});

	$(document).on('click', '.xmpp-invite-actions', function(ev) {

		ev.stopPropagation();
		var $tab = $(this).parents('div.ui-tabs-panel');
		var jid = $tab.data('jid');
		var name = $tab.data('name');
		var resource = $tab.data('resource');
		var room = Xpressive.mucGetRoom(jid);
		
		Xpressive.log("xmpp-invite-actions:" + jid + "/" + name + "/" + resource);
		room.invite();
	});

	$('#disconnect').click(function() {
		Xpressive.sessionDisconnect();
	});

	$('#available-pres').click(function() {
		Xpressive.connection.me.available();
	});

	$('#away-pres').click(function() {
		Xpressive.connection.me.away();
	});

	$('#toggle-lists, .ui-list').click(function() {
		$('#toggle-lists').text('Show ' + listShowing);
		if (listShowing === "Contacts") {
			$('#roster-area').addClass('hidden');
			$('#muc-area').removeClass('hidden');
			listShowing = "Rooms";
		} else {
			$('#muc-area').addClass('hidden');
			$('#roster-area').removeClass('hidden');
			listShowing = "Contacts";
		}
	});

	$('#send_button').click(function() {
		var input = $('#input').val();
		var error = false;
		if (input.length > 0) {
			if (input[0] === '<') {
				var xml = Xpressive.text_to_xml(input);
				if (xml) {
					Xpressive.connection.send(xml);
					$('#input').val('');
				} else {
					error = true;
				}
			} else if (input[0] === '$') {
				try {
					var builder = eval(input);
					Xpressive.connection.send(builder);
					$('#input').val('');
				} catch (e) {
					console.log(e);
					error = true;
				}
			} else {
				error = true;
			}
		}

		if (error) {
			$('#input').animate({
				backgroundColor : "#faa"
			});
		}
	});

/**
 * TODO: KEYPRESS EVENT HANDLERS 
 */

	$(document).on('keypress', '.chat-input', function(ev) {
		var jid = $(this).parent().data('jid');
		var resource;
		var groupChat = $(this).parent().data('groupChat');

		if (ev.which === 13) {
			ev.preventDefault();

			var topic = $('.chat-topic').val(); 
			var body = $(this).val();
			Xpressive.connection.chat.sendNewMessage(jid, resource, body, groupChat);

			$(this).val('');
			$(this).parent().data('composing', false);
		} else {
			if (!groupChat){
				var composing = $(this).parent().data('composing');
				if (!composing) {
					Xpressive.connection.chatstates.sendComposing(jid);

					$(this).parent().data('composing', true);
				}
			}
		}
	});

	$(document).on('keypress', '.chat-topic', function(ev) {
		var jid = $(this).parent().parent().data('jid');
		var groupChat = $(this).parent().data('groupChat');

		if (ev.which === 13) {
			ev.preventDefault();

			var topic = $(this).val();
			Xpressive.connection.chat.sendNewTopic(jid, topic);

			$(this).val('');
		}
	});

	$('#input').keypress(function() {
		$(this).css({
			backgroundColor : '#fff'
		});
	});

/**
 * TODO: MOUSE EVENT HANDLERS 
 */

	$(document).on('mouseenter', '.my-status', function ( e ) {
		var $elem = $( this );
		var $tooltip = $elem.find('div');
		var offset = $tooltip.offset();

		$elem.doTimeout( "hoverOut" );
		$elem.doTimeout( "hoverIn", 500, function () {
			$tooltip.css('left', e.pageX).css('top', e.pageY);
			$tooltip.fadeTo( 200, 1.0 );
		});
	});

	$(document).on( 'mouseleave', '.my-status', function ( e ) {
		var $elem = $( this );

		$elem.doTimeout( "hoverIn" );
		$elem.doTimeout( "hoverOut", 500, function () {
			$elem.find( "div" ).stop( true ).fadeOut();
		});
	});

	$(document).on('mouseenter', '.chat-text li', function ( e ) {
		var $li = $( this );
		var $div = $li.find('div');
		var offset = $div.offset();

		$li.doTimeout( "hoverOut" );
		$li.doTimeout( "hoverIn", 500, function () {
			$div.css('left', e.pageX).css('top', e.pageY);
			$div.fadeTo( 200, 1.0 );
		});
	});

	$(document).on( 'mouseleave', '.chat-text li', function ( e ) {
		var $li = $( this );

		$li.doTimeout( "hoverIn" );
		$li.doTimeout( "hoverOut", 500, function () {
			$li.find( "div" ).stop( true ).fadeOut();
		});
	});

	$(document).on('mouseenter', 'img', function ( e ) {
		var $img = $( this );
		var $div = $img.next('div');
		var offset = $div.offset();

		$img.doTimeout( "hoverOut" );
		$img.doTimeout( "hoverIn", 500, function () {
			$div.css('left', e.pageX).css('top', e.pageY);
			$div.fadeTo( 200, 1.0 );
		});
	});

	$(document).on( 'mouseleave', 'img', function ( e ) {
		var $img = $( this );

		$img.doTimeout( "hoverIn" );
		$img.doTimeout( "hoverOut", 500, function () {
			$img.next( "div" ).stop( true ).fadeOut();
		});
	});
});