import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Image, FileText, Video, Download, Copy, ExternalLink, Check, Plus, Trash2, LogOut, User } from 'lucide-react';

export default function ContentCreatorBot() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      
      // Get user data from Telegram
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setUsername(user.first_name || user.username || 'User');
        setTelegramId(user.id.toString());
        setIsAuthenticated(true);
        loadUserChats(user.id.toString());
      }
    }
  }, []);

  const loadUserChats = async (userId) => {
    try {
      const result = await window.storage.list(`chat:${userId}:`);
      if (result && result.keys) {
        const chatList = await Promise.all(
          result.keys.map(async (key) => {
            try {
              const data = await window.storage.get(key);
              return data ? JSON.parse(data.value) : null;
            } catch {
              return null;
            }
          })
        );
        const validChats = chatList.filter(chat => chat !== null);
        setChats(validChats);
        if (validChats.length > 0) {
          loadChat(validChats[0].id);
        } else {
          createNewChat();
        }
      } else {
        createNewChat();
      }
    } catch (error) {
      console.log('No existing chats, creating new one');
      createNewChat();
    }
  };

  const handleLogin = () => {
    if (loginInput.trim()) {
      const mockId = `user_${Date.now()}`;
      setUsername(loginInput.trim());
      setTelegramId(mockId);
      setIsAuthenticated(true);
      loadUserChats(mockId);
      setLoginInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setTelegramId('');
    setChats([]);
    setCurrentChatId(null);
    setMessages([]);
  };

  const createNewChat = () => {
    const newChatId = `chat:${telegramId}:${Date.now()}`;
    const newChat = {
      id: newChatId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: 'Hi! I\'m your AI Content Creator. Tell me what topic you\'d like to create content about, and I\'ll help you generate a short video script, image description, or article!'
        }
      ]
    };
    
    setChats([newChat, ...chats]);
    setCurrentChatId(newChatId);
    setMessages(newChat.messages);
    setContentType(null);
    setGeneratedContent(null);
    
    saveChatToStorage(newChat);
  };

  const loadChat = async (chatId) => {
    try {
      const result = await window.storage.get(chatId);
      if (result) {
        const chat = JSON.parse(result.value);
        setCurrentChatId(chatId);
        setMessages(chat.messages);
        setContentType(null);
        setGeneratedContent(null);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const saveChatToStorage = async (chat) => {
    try {
      await window.storage.set(chat.id, JSON.stringify(chat));
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  };

  const deleteChat = async (chatId) => {
    try {
      await window.storage.delete(chatId);
      const updatedChats = chats.filter(c => c.id !== chatId);
      setChats(updatedChats);
      
      if (currentChatId === chatId) {
        if (updatedChats.length > 0) {
          loadChat(updatedChats[0].id);
        } else {
          createNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const updateChatTitle = (chatMessages) => {
    const userMessages = chatMessages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      const firstMessage = userMessages[0].content;
      return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    }
    return 'New Conversation';
  };

  const callClaude = async (conversationHistory) => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: conversationHistory,
          system: `You are a helpful content creation assistant. Your job is to:
1. Ask clarifying questions about the user's topic to understand their goals, target audience, tone, and key points
2. After gathering enough information, offer to create one of: a short video script (30-60 seconds), an image description (for AI image generation), or a brief article (300-500 words)
3. When creating content, be creative, engaging, and tailored to the information provided

Keep questions focused and don't ask more than 2-3 clarifying questions before offering to create content.
When the user chooses a content type, generate it immediately without asking more questions.`
        })
      });

      const data = await response.json();
      return data.content.map(item => item.type === 'text' ? item.text : '').join('\n');
    } catch (error) {
      console.error('API Error:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const conversationHistory = newMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await callClaude(conversationHistory);
    
    const updatedMessages = [...newMessages, { role: 'assistant', content: response }];
    setMessages(updatedMessages);
    
    // Update chat in storage
    const currentChat = chats.find(c => c.id === currentChatId);
    if (currentChat) {
      const updatedChat = {
        ...currentChat,
        messages: updatedMessages,
        title: updateChatTitle(updatedMessages),
        updatedAt: new Date().toISOString()
      };
      await saveChatToStorage(updatedChat);
      setChats(chats.map(c => c.id === currentChatId ? updatedChat : c));
    }
    
    setLoading(false);

    if (response.includes('VIDEO SCRIPT') || response.includes('**Video Script')) {
      setContentType('video');
      setGeneratedContent(response);
    } else if (response.includes('IMAGE DESCRIPTION') || response.includes('**Image Description')) {
      setContentType('image');
      setGeneratedContent(response);
    } else if (response.includes('ARTICLE') || response.length > 500) {
      setContentType('article');
      setGeneratedContent(response);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const generateContent = async (type) => {
    setLoading(true);
    const requestMessage = { 
      role: 'user', 
      content: `Please create a ${type} based on our conversation.` 
    };
    const newMessages = [...messages, requestMessage];
    setMessages(newMessages);

    const conversationHistory = newMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await callClaude(conversationHistory);
    
    const updatedMessages = [...newMessages, { role: 'assistant', content: response }];
    setMessages(updatedMessages);
    
    // Update chat in storage
    const currentChat = chats.find(c => c.id === currentChatId);
    if (currentChat) {
      const updatedChat = {
        ...currentChat,
        messages: updatedMessages,
        updatedAt: new Date().toISOString()
      };
      await saveChatToStorage(updatedChat);
      setChats(chats.map(c => c.id === currentChatId ? updatedChat : c));
    }
    
    setContentType(type);
    setGeneratedContent(response);
    setLoading(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadAsFile = () => {
    const extension = 'txt';
    const filename = `content_${Date.now()}.${extension}`;
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getToolLinks = () => {
    if (contentType === 'image') {
      return [
        { name: 'Bing Image Creator', url: 'https://www.bing.com/images/create', free: true },
        { name: 'Leonardo.ai', url: 'https://leonardo.ai/', free: true },
        { name: 'Stable Diffusion', url: 'https://stablediffusionweb.com/', free: true },
        { name: 'Craiyon', url: 'https://www.craiyon.com/', free: true }
      ];
    } else if (contentType === 'video') {
      return [
        { name: 'Canva Video', url: 'https://www.canva.com/create/videos/', free: true },
        { name: 'CapCut', url: 'https://www.capcut.com/', free: true },
        { name: 'DaVinci Resolve', url: 'https://www.blackmagicdesign.com/products/davinciresolve', free: true },
        { name: 'Clipchamp', url: 'https://clipchamp.com/', free: true }
      ];
    } else if (contentType === 'article') {
      return [
        { name: 'Medium', url: 'https://medium.com/new-story', free: true },
        { name: 'WordPress', url: 'https://wordpress.com/', free: true },
        { name: 'Blogger', url: 'https://www.blogger.com/', free: true },
        { name: 'LinkedIn Articles', url: 'https://www.linkedin.com/', free: true }
      ];
    }
    return [];
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">AI Content Creator Bot</h1>
            <p className="text-gray-600 text-sm">Sign in to start creating amazing content</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleLogin}
              disabled={!loginInput.trim()}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
            >
              Sign In
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>📱 Telegram Users:</strong> This bot auto-authenticates when opened in Telegram!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* User Info */}
        <div className="p-4 border-b border-gray-200 bg-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <span className="font-semibold text-sm truncate">{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 hover:bg-indigo-700 rounded transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition group ${
                currentChatId === chat.id ? 'bg-indigo-50' : ''
              }`}
              onClick={() => loadChat(chat.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {chat.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition"
                  title="Delete chat"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-md p-4 border-b-2 border-indigo-500">
          <h1 className="text-2xl font-bold text-indigo-700">AI Content Creator Bot</h1>
          <p className="text-sm text-gray-600">Create engaging content and publish it with free tools!</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-lg shadow-md">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Generated Content Actions */}
        {generatedContent && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-green-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-800">
                  {contentType === 'video' && '🎬 Video Script Ready'}
                  {contentType === 'image' && '🎨 Image Prompt Ready'}
                  {contentType === 'article' && '📝 Article Ready'}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={downloadAsFile}
                    className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {contentType === 'image' && '🎨 Use your prompt with these free AI image generators:'}
                  {contentType === 'video' && '🎬 Create your video with these free tools:'}
                  {contentType === 'article' && '📝 Publish your article on these platforms:'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {getToolLinks().map((tool, idx) => (
                    <a
                      key={idx}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition group"
                    >
                      <span className="text-sm font-medium text-indigo-700">{tool.name}</span>
                      <ExternalLink className="w-4 h-4 text-indigo-500 group-hover:text-indigo-700" />
                    </a>
                  ))}
                </div>
                {contentType === 'image' && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>💡 Tip:</strong> Copy your image description above and paste it into any of these tools to generate your image!
                    </p>
                  </div>
                )}
                {contentType === 'video' && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>💡 Tip:</strong> Use your script to create scenes, add voiceover, and edit your video in these free tools!
                    </p>
                  </div>
                )}
                {contentType === 'article' && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-800">
                      <strong>💡 Tip:</strong> Copy your article and paste it directly into your chosen platform. Add images for better engagement!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content Type Selector */}
        {messages.length > 4 && !generatedContent && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-lg shadow-md p-4 border-2 border-indigo-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">Ready to create? Choose a format:</p>
              <div className="flex gap-3">
                <button
                  onClick={() => generateContent('short video script')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  disabled={loading}
                >
                  <Video className="w-4 h-4" />
                  Video Script
                </button>
                <button
                  onClick={() => generateContent('AI image description')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  disabled={loading}
                >
                  <Image className="w-4 h-4" />
                  Image Prompt
                </button>
                <button
                  onClick={() => generateContent('brief article')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  disabled={loading}
                >
                  <FileText className="w-4 h-4" />
                  Article
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your topic or answer the question..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows="2"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}