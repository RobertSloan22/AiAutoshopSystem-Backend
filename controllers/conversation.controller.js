import Conversation from '../models/conversation.model.js';


export const getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(conversations);
  } catch (error) {
    console.error('Error in getAllConversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error in getConversationById:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { title, items, realtimeEvents, lastExchange, keyPoints, notes } = req.body;
    
    // Trim and validate arrays
    const trimmedItems = (items || []).slice(-50);
    const trimmedEvents = (realtimeEvents || []).map(event => ({
      type: event.type || 'unknown',
      timestamp: new Date(event.timestamp || Date.now()),
      data: event
    })).slice(-10);
    const trimmedKeyPoints = (keyPoints || []).slice(-5);
    
    const conversation = await Conversation.create({
      title,
      userId: req.user._id,
      items: trimmedItems,
      realtimeEvents: trimmedEvents,
      lastExchange: lastExchange || {
        userMessage: '',
        assistantMessage: ''
      },
      keyPoints: trimmedKeyPoints,
      notes: notes || [],
      timestamp: new Date()
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error in createConversation:', error);
    res.status(500).json({ 
      error: 'Failed to save conversation', 
      details: error.message 
    });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error in deleteConversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

export const searchConversations = async (req, res) => {
  try {
    const { query, filter } = req.query;
    const userId = req.user._id;

    let searchQuery = { userId };
    if (query) {
      switch(filter) {
        case 'topic':
          searchQuery.title = { $regex: query, $options: 'i' };
          break;
        case 'tags':
          searchQuery['notes.tags'] = { $regex: query, $options: 'i' };
          break;
        case 'content':
          searchQuery.$or = [
            { 'notes.keyPoints': { $regex: query, $options: 'i' } },
            { 'lastExchange.userMessage': { $regex: query, $options: 'i' } },
            { 'lastExchange.assistantMessage': { $regex: query, $options: 'i' } }
          ];
          break;
        default:
          searchQuery.$or = [
            { title: { $regex: query, $options: 'i' } },
            { 'notes.tags': { $regex: query, $options: 'i' } },
            { 'notes.keyPoints': { $regex: query, $options: 'i' } }
          ];
      }
    }

    const conversations = await Conversation.find(searchQuery).sort({ updatedAt: -1 });
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getRecentConversations = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(conversations);
  } catch (error) {
    console.error('Error in getRecentConversations:', error);
    res.status(500).json({ error: 'Failed to fetch recent conversations' });
  }
}; 