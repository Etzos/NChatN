var smileyManager = (function($, tooltip, document){
    var $container;
    var smilies = [
        { id:'0',  name: 'Smile', text: [':)', ':-)'] },
        { id:'1',  name: 'Sticking Tongue Out', text: [':P', ':p', ':-P', ':-p'] },
        { id:'2',  name: 'Yell', text: [':O', ':o', ':-O', ':-o'] },
        { id:'3',  name: 'Frown', text: [':(', ':-('] },
        { id:'4',  name: 'Undecided', text: [':-/'] },
        { id:'5',  name: 'Wink', text: [';)', ';-)'] },
        { id:'6',  name: 'Grin', text: [':D', ':-D'] },
        { id:'7',  name: 'Sunglasses', text: ['8)', '8-)'] },
        { id:'8',  name: 'Masked', text: ['B)', 'B-)'] },
        { id:'9',  name: 'Laughing', text: ['XD'] },
        { id:'10', name: 'Crying', text: ['T.T'] },
        { id:'11', name: 'Sweat Drop', text: ['^^\''] },
        { id:'12', name: 'Happy', text: ['^.^', '^^'] },
        { id:'13', name: 'Surprised', text: ['O.O', 'o.o'] },
        { id:'14', name: 'Scowl', text: ['8|', '8-|'] },
        { id:'15', name: 'Rock On', text: ['\\M/'] },
        { id:'16', name: 'D\'oh', text: ['>.<'] },
        { id:'17', name: 'Excited Laughing', text: ['XP'] },
        { id:'18', name: 'Shocked', text: ['o.O', 'oO'] },
        { id:'19', name: 'Tired', text: ['-.-'] },
        { id:'20', name: 'Evil Grin', text: ['(:<'] },
        { id:'21', name: 'Facepalm', text: ['f/'] },
        { id:'22', name: 'Unsure', text: [':S', ':s'] },
        { id:'23', name: 'Evil', text: ['*.*'] },
        { id:'24', name: 'Sealed Lips', text: [':X'] },
        { id:'25', name: 'Dead', text: ['X.X', 'x.x'] },
        { id:'26', name: 'Money Eyes', text: ['$.$'] },
        { id:'27', name: 'Embarrased', text: ['o@@o'] },
        { id:'28', name: 'Eye Roll', text: ['9.9'] },
        { id:'29', name: 'Angry Yell', text: ['O:<'] },
        { id:'30', name: 'Straight Face', text: ['B|'] },
        { id:'31', name: 'Puppy Eyes', text: ['B('] },
        { id:'32', name: 'Firey Eyes', text: ['B0'] },
        { id:'33', name: 'Confused', text: ['@.@'] },
        { id:'34', name: 'Evil Horns', text: ['^**^'] },
        { id:'35', name: 'Eyes Spinning', text: ['9.6'] },
        { id:'36', name: 'Pirate', text: ['/.O'] },
        { id:'37', name: 'Frustrated', text: ['d.b'] },
        { id:'38', name: 'Annoyed', text: ['>.>'] },
        { id:'39', name: 'Kitty', text: ['=^_^='] }
    ];
    
    function isSmiley(text) {
        $.each(smilies, function(index, smiley) {
            if($.inArray(text, smiley.text)) {
                return index;
            }
        });
        return false;
    }
    
    function drawTable() {
        // Get the container
        $container = $('#smileyContainer');
        // Bind to the link
        $('#smileyLink').click(function(event) {
            $(document).one('click', function() {
                $('#smileyContainer').hide();
            });
            $('#smileyContainer').toggle();
            
            event.stopPropagation();
            return false;
        });
        $.each(smilies, function(index, smiley) {
            var $entry = $('<a href="#"><img src="http://www.nowhere-else.org/smilies/'+smiley.id+'.gif" alt="'+smiley.name+'"></a>');
            $entry.click(function() {
                chatRoom.insertInputText(' '+smiley.text[0]);
                $('#smileyContainer').toggle();
                return false;
            })
            .hover(function(event) {
                tooltip.on(smiley.name, event.pageX, event.pageY);
            }, function() {
                tooltip.off(); 
            });
            $container.append($entry);
        });
    }
    
    function getId(smileyId) {
        for(var i=0; i<smilies.length; i++) {
            if(smilies[i].id === smileyId)
                return smilies[i];
        }
        console.error('Given smiley id is not valid: '+smileyId);
    }
    
    function getSmileyText(id) {
        return getId(id).text[0];
    }
    
    return {
        'init': function() {
            drawTable();
        },
        'toggleTable': function() {
            $container.toggle();
        },
        'getSmileyText': function(id) {
            return getSmileyText(id);
        }
    };
})(jQuery, tooltip, document);
