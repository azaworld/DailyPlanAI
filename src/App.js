import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc,updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { Check, X, Edit, Trash2, Calendar, Lightbulb, Send, Loader2, Plus } from 'lucide-react';
import { firebaseConfig } from './firebase';

const App = () => {
  // Firebase related states
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // App data states
  const [dailyPlans, setDailyPlans] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);

  // Input states for forms
  const [newPlanText, setNewPlanText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');

  // Editing states
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editingPlanText, setEditingPlanText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [editingReminderText, setEditingReminderText] = useState('');
  const [editingReminderDate, setEditingReminderDate] = useState('');
  const [editingReminderTime, setEditingReminderTime] = useState('');

  // UI states
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'notes', 'reminders', 'ai'
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalCallback, setModalCallback] = useState(null);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Refs for input focus
  const aiInputRef = useRef(null);

  // Firestore paths helper
  const getCollectionPath = (collectionName) => {
    const appId = 'dailyplanner-446bf'; // আপনার প্রকৃত Firebase project/app ID
    return `artifacts/${appId}/users/${userId}/${collectionName}`;
  };
  

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    const initializedApp = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(initializedApp);
    const firebaseAuth = getAuth(initializedApp);
  
    setDb(firestoreDb); // ✅ keep only if used
    // setApp(initializedApp); ❌ remove if not used
    // setAuth(firebaseAuth); ❌ remove if not used
  
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          await signInAnonymously(firebaseAuth);
        } catch (error) {
          console.error("Error signing in anonymously:", error);
          setUserId(crypto.randomUUID());
        }
      }
      setIsAuthReady(true);
    });
  
    return () => unsubscribe();
  }, []);
  
  

  // 2. Data Fetching and Real-time Listeners (onSnapshot)
  useEffect(() => {
      if (!db || !userId || !isAuthReady) return; // Ensure Firebase is ready and user ID is set

      // Daily Plans
      // Note: orderBy is commented out as per instructions to avoid potential index issues
      // For simple apps, client-side sorting after fetch is often sufficient.
      const qDailyPlans = collection(db, getCollectionPath('dailyPlans'));
      const unsubscribeDailyPlans = onSnapshot(qDailyPlans, (snapshot) => {
          // Sort client-side
          const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0));
          setDailyPlans(plans);
      }, (error) => console.error("Error fetching daily plans:", error));

      // Notes
      const qNotes = collection(db, getCollectionPath('notes'));
      const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
          // Sort client-side
          const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
          setNotes(notesData);
      }, (error) => console.error("Error fetching notes:", error));

      // Reminders
      const qReminders = collection(db, getCollectionPath('reminders'));
      const unsubscribeReminders = onSnapshot(qReminders, (snapshot) => {
          // Sort client-side by date then time
          const remindersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
              const dateA = new Date(`${a.reminderDate}T${a.reminderTime}`);
              const dateB = new Date(`${b.reminderDate}T${b.reminderTime}`);
              return dateA - dateB;
          });
          setReminders(remindersData);
      }, (error) => console.error("Error fetching reminders:", error));

      return () => {
          // Cleanup listeners on component unmount or dependencies change
          unsubscribeDailyPlans();
          unsubscribeNotes();
          unsubscribeReminders();
      };
  }, [db, userId, isAuthReady]); // Re-run when db, userId, or auth status changes

  // --- CRUD Operations for Daily Plans ---
  const addDailyPlan = async () => {
      if (!db || !userId || !newPlanText.trim()) {
          showCustomModal("Daily plan cannot be empty.");
          return;
      }
      try {
          await addDoc(collection(db, getCollectionPath('dailyPlans')), {
              text: newPlanText.trim(),
              completed: false,
              timestamp: new Date(), // Use Firestore Timestamp
          });
          setNewPlanText('');
      } catch (e) {
          console.error("Error adding daily plan: ", e);
          showCustomModal("Error adding daily plan. Please try again.");
      }
  };

  const togglePlanCompletion = async (id, completed) => {
      if (!db || !userId) return;
      try {
          const planDocRef = doc(db, getCollectionPath('dailyPlans'), id);
          await updateDoc(planDocRef, {
              completed: !completed
          });
      } catch (e) {
          console.error("Error toggling completion: ", e);
          showCustomModal("Error updating plan status. Please try again.");
      }
  };

  const startEditingPlan = (plan) => {
      setEditingPlanId(plan.id);
      setEditingPlanText(plan.text);
  };

  const updateDailyPlan = async (id) => {
      if (!db || !userId || !editingPlanText.trim()) {
          showCustomModal("Daily plan cannot be empty.");
          return;
      }
      try {
          const planDocRef = doc(db, getCollectionPath('dailyPlans'), id);
          await updateDoc(planDocRef, {
              text: editingPlanText.trim()
          });
          setEditingPlanId(null);
          setEditingPlanText('');
      } catch (e) {
          console.error("Error updating plan: ", e);
          showCustomModal("Error updating daily plan. Please try again.");
      }
  };

  const deleteDailyPlan = (id) => {
      showCustomModal("Are you sure you want to delete this daily plan?", async () => {
          if (!db || !userId) return;
          try {
              await deleteDoc(doc(db, getCollectionPath('dailyPlans'), id));
          } catch (e) {
              console.error("Error deleting plan: ", e);
              showCustomModal("Error deleting daily plan. Please try again.");
          }
          // Modal is closed by handleModalConfirm after callback
      });
  };

  // --- CRUD Operations for Notes ---
  const addNote = async () => {
      if (!db || !userId || !newNoteText.trim()) {
          showCustomModal("Note cannot be empty.");
          return;
      }
      try {
          await addDoc(collection(db, getCollectionPath('notes')), {
              text: newNoteText.trim(),
              timestamp: new Date(), // Use Firestore Timestamp
          });
          setNewNoteText('');
      } catch (e) {
          console.error("Error adding note: ", e);
          showCustomModal("Error adding note. Please try again.");
      }
  };

  const startEditingNote = (note) => {
      setEditingNoteId(note.id);
      setEditingNoteText(note.text);
  };

  const updateNote = async (id) => {
      if (!db || !userId || !editingNoteText.trim()) {
          showCustomModal("Note cannot be empty.");
          return;
      }
      try {
          const noteDocRef = doc(db, getCollectionPath('notes'), id);
          await updateDoc(noteDocRef, {
              text: editingNoteText.trim()
          });
          setEditingNoteId(null);
          setEditingNoteText('');
      } catch (e) {
          console.error("Error updating note: ", e);
          showCustomModal("Error updating note. Please try again.");
      }
  };

  const deleteNote = (id) => {
      showCustomModal("Are you sure you want to delete this note?", async () => {
          if (!db || !userId) return;
          try {
              await deleteDoc(doc(db, getCollectionPath('notes'), id));
          } catch (e) {
              console.error("Error deleting note: ", e);
              showCustomModal("Error deleting note. Please try again.");
          }
      });
  };

  // --- CRUD Operations for Reminders ---
  const addReminder = async () => {
      if (!db || !userId || !newReminderText.trim() || !newReminderDate || !newReminderTime) {
          showCustomModal("Reminder text, date, and time cannot be empty.");
          return;
      }
      try {
          await addDoc(collection(db, getCollectionPath('reminders')), {
              text: newReminderText.trim(),
              reminderDate: newReminderDate,
              reminderTime: newReminderTime,
              timestamp: new Date(), // Use Firestore Timestamp
          });
          setNewReminderText('');
          setNewReminderDate('');
          setNewReminderTime('');
      } catch (e) {
          console.error("Error adding reminder: ", e);
          showCustomModal("Error adding reminder. Please try again.");
      }
  };

  const startEditingReminder = (reminder) => {
      setEditingReminderId(reminder.id);
      setEditingReminderText(reminder.text);
      setEditingReminderDate(reminder.reminderDate);
      setEditingReminderTime(reminder.reminderTime);
  };

  const updateReminder = async (id) => {
      if (!db || !userId || !editingReminderText.trim() || !editingReminderDate || !editingReminderTime) {
          showCustomModal("Reminder text, date, and time cannot be empty.");
          return;
      }
      try {
          const reminderDocRef = doc(db, getCollectionPath('reminders'), id);
          await updateDoc(reminderDocRef, {
              text: editingReminderText.trim(),
              reminderDate: editingReminderDate,
              reminderTime: editingReminderTime,
          });
          setEditingReminderId(null);
          setEditingReminderText('');
          setEditingReminderDate('');
          setEditingReminderTime('');
      } catch (e) {
          console.error("Error updating reminder: ", e);
          showCustomModal("Error updating reminder. Please try again.");
      }
  };

  const deleteReminder = (id) => {
      showCustomModal("Are you sure you want to delete this reminder?", async () => {
          if (!db || !userId) return;
          try {
              await deleteDoc(doc(db, getCollectionPath('reminders'), id));
          } catch (e) {
              console.error("Error deleting reminder: ", e);
              showCustomModal("Error deleting reminder. Please try again.");
          }
      });
  };

  // --- AI Assistant Functionality ---
  const generateAIResponse = async () => {
      if (!aiInput.trim()) {
          showCustomModal("Please enter some text for the AI assistant.");
          return;
      }

      setAiLoading(true);
      setAiResponse(''); // Clear previous response

      try {
          const prompt = `Based on the following text, provide a helpful and concise response. You can summarize, expand, rephrase, or suggest ideas. Text: "${aiInput}"`;
          let chatHistory = [];
          chatHistory.push({ role: "user", parts: [{ text: prompt }] });
          const payload = { contents: chatHistory };
          const apiKey = ""; // Canvas will automatically provide the API key
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

          const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`API error: ${response.status} - ${errorData.error.message || response.statusText}`);
          }

          const result = await response.json();

          if (result.candidates && result.candidates.length > 0 &&
              result.candidates[0].content && result.candidates[0].content.parts &&
              result.candidates[0].content.parts.length > 0) {
              const text = result.candidates[0].content.parts[0].text;
              setAiResponse(text);
          } else {
              setAiResponse("No response from AI. Please try again.");
          }
      } catch (error) {
          console.error("Error generating AI response:", error);
          setAiResponse(`Error: ${error.message}. Please ensure the input is appropriate.`);
      } finally {
          setAiLoading(false);
      }
  };

  // --- Custom Modal for Confirmations/Alerts ---
  const showCustomModal = (message, callback = null) => {
      setModalMessage(message);
      // Store the callback function, ensuring it's not directly called
      setModalCallback(() => callback);
      setShowModal(true);
  };

  const handleModalConfirm = () => {
      if (modalCallback) {
          modalCallback(); // Execute the stored callback
      }
      setShowModal(false);
      setModalCallback(null); // Clear the callback
  };

  const handleModalCancel = () => {
      setShowModal(false);
      setModalCallback(null); // Clear the callback
  };

  // Helper for formatting date display
  const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
          const [year, month, day] = dateString.split('-');
          const date = new Date(year, month - 1, day);
          return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch (e) {
          console.error("Error formatting date:", e);
          return dateString; // Return original if error
      }
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 font-sans text-gray-800 p-4 sm:p-6 md:p-8 flex flex-col items-center">
          {/* Custom Modal */}
          {showModal && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
                  <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm transform scale-95 animate-scale-in">
                      <p className="text-lg text-center mb-6 text-gray-700">{modalMessage}</p>
                      <div className="flex justify-center space-x-4">
                          {modalCallback && (
                              <button
                                  onClick={handleModalConfirm}
                                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition duration-200 transform hover:scale-105 font-semibold"
                              >
                                  Confirm
                              </button>
                          )}
                          <button
                              onClick={handleModalCancel}
                              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg shadow-md hover:bg-gray-300 transition duration-200 transform hover:scale-105 font-semibold"
                          >
                              {modalCallback ? "Cancel" : "OK"}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 transform transition-all duration-300">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-pink-500 mb-6 sm:mb-8 tracking-tight">
              ZenFlow Aura
              </h1>

              {/* User ID Display */}
              {userId && (
                  <p className="text-center text-sm text-gray-500 mb-6">
                      User ID: <span className="font-mono text-gray-600 text-xs sm:text-sm break-all select-all">{userId}</span>
                  </p>
              )}

              {/* Tab Navigation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-100 rounded-2xl p-2 mb-8 shadow-inner">
                  <button
                      className={`flex items-center justify-center py-3 px-2 sm:px-4 text-center rounded-xl text-md sm:text-lg font-medium transition-all duration-300 ${activeTab === 'daily' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setActiveTab('daily')}
                  >
                      <Calendar className="inline-block mr-2 w-5 h-5" /> Daily Plan
                  </button>
                  <button
                      className={`flex items-center justify-center py-3 px-2 sm:px-4 text-center rounded-xl text-md sm:text-lg font-medium transition-all duration-300 ${activeTab === 'notes' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setActiveTab('notes')}
                  >
                      <Lightbulb className="inline-block mr-2 w-5 h-5" /> Notes
                  </button>
                  <button
                      className={`flex items-center justify-center py-3 px-2 sm:px-4 text-center rounded-xl text-md sm:text-lg font-medium transition-all duration-300 ${activeTab === 'reminders' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setActiveTab('reminders')}
                  >
                      <Check className="inline-block mr-2 w-5 h-5" /> Reminders
                  </button>
                  <button
                      className={`flex items-center justify-center py-3 px-2 sm:px-4 text-center rounded-xl text-md sm:text-lg font-medium transition-all duration-300 ${activeTab === 'ai' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setActiveTab('ai')}
                  >
                      <Send className="inline-block mr-2 w-5 h-5" /> AI Assistant
                  </button>
              </div>

              {/* Content for Daily Plan Tab */}
              {activeTab === 'daily' && (
                  <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4 items-center bg-gray-50 p-6 rounded-2xl shadow-lg border border-gray-100">
                          <input
                              type="text"
                              placeholder="Add a new daily plan item..."
                              className="flex-grow p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full transition duration-200"
                              value={newPlanText}
                              onChange={(e) => setNewPlanText(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addDailyPlan()}
                          />
                          <button
                              onClick={addDailyPlan}
                              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-indigo-700 transition duration-200 transform hover:scale-105 text-lg font-semibold flex items-center justify-center"
                          >
                              <Plus className="mr-2 w-5 h-5" /> Add Plan
                          </button>
                      </div>

                      {dailyPlans.length === 0 ? (
                          <p className="text-center text-gray-500 text-lg py-8 bg-white rounded-xl shadow-md border border-gray-100">No daily plans added yet. Start planning your day!</p>
                      ) : (
                          <ul className="space-y-4">
                              {dailyPlans.map((plan) => (
                                  <li key={plan.id} className="flex flex-col sm:flex-row items-start sm:items-center bg-white p-4 rounded-xl shadow-md border border-gray-100 group hover:shadow-lg transition duration-200">
                                      {editingPlanId === plan.id ? (
                                          <input
                                              type="text"
                                              value={editingPlanText}
                                              onChange={(e) => setEditingPlanText(e.target.value)}
                                              onBlur={() => updateDailyPlan(plan.id)}
                                              onKeyPress={(e) => e.key === 'Enter' && updateDailyPlan(plan.id)}
                                              className="flex-grow p-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full mb-2 sm:mb-0"
                                              autoFocus
                                          />
                                      ) : (
                                          <span
                                              className={`flex-grow text-lg sm:text-xl font-medium cursor-pointer p-1 rounded-md transition duration-200 ${plan.completed ? 'line-through text-gray-400 italic' : 'text-gray-800'}`}
                                              onClick={() => togglePlanCompletion(plan.id, plan.completed)}
                                          >
                                              {plan.text}
                                          </span>
                                      )}
                                      <div className="flex space-x-2 mt-2 sm:mt-0 sm:ml-auto">
                                          <button
                                              onClick={() => togglePlanCompletion(plan.id, plan.completed)}
                                              className={`p-2 rounded-full transition duration-200 transform hover:scale-110 ${plan.completed ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
                                              title={plan.completed ? "Mark as Incomplete" : "Mark as Complete"}
                                          >
                                              <Check className="w-5 h-5" />
                                          </button>
                                          <button
                                              onClick={() => startEditingPlan(plan)}
                                              className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition duration-200 transform hover:scale-110"
                                              title="Edit"
                                          >
                                              <Edit className="w-5 h-5" />
                                          </button>
                                          <button
                                              onClick={() => deleteDailyPlan(plan.id)}
                                              className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition duration-200 transform hover:scale-110"
                                              title="Delete"
                                          >
                                              <Trash2 className="w-5 h-5" />
                                          </button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
              )}

              {/* Content for Notes Tab */}
              {activeTab === 'notes' && (
                  <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4 items-center bg-gray-50 p-6 rounded-2xl shadow-lg border border-gray-100">
                          <textarea
                              placeholder="Write a new note..."
                              rows="3"
                              className="flex-grow p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full resize-y transition duration-200"
                              value={newNoteText}
                              onChange={(e) => setNewNoteText(e.target.value)}
                          ></textarea>
                          <button
                              onClick={addNote}
                              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-indigo-700 transition duration-200 transform hover:scale-105 text-lg font-semibold flex items-center justify-center"
                          >
                              <Plus className="mr-2 w-5 h-5" /> Add Note
                          </button>
                      </div>

                      {notes.length === 0 ? (
                          <p className="text-center text-gray-500 text-lg py-8 bg-white rounded-xl shadow-md border border-gray-100">No notes added yet. Jot down your thoughts!</p>
                      ) : (
                          <ul className="space-y-4">
                              {notes.map((note) => (
                                  <li key={note.id} className="flex flex-col bg-white p-4 rounded-xl shadow-md border border-gray-100 group hover:shadow-lg transition duration-200">
                                      {editingNoteId === note.id ? (
                                          <textarea
                                              value={editingNoteText}
                                              onChange={(e) => setEditingNoteText(e.target.value)}
                                              onBlur={() => updateNote(note.id)}
                                              rows="3"
                                              className="flex-grow p-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full mb-2 resize-y"
                                              autoFocus
                                          ></textarea>
                                      ) : (
                                          <span
                                              className="flex-grow text-lg sm:text-xl font-medium text-gray-800 whitespace-pre-wrap break-words p-1 rounded-md cursor-pointer"
                                              onClick={() => startEditingNote(note)}
                                          >
                                              {note.text}
                                          </span>
                                      )}
                                      <div className="flex justify-end space-x-2 mt-4">
                                          <button
                                              onClick={() => startEditingNote(note)}
                                              className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition duration-200 transform hover:scale-110"
                                              title="Edit"
                                          >
                                              <Edit className="w-5 h-5" />
                                          </button>
                                          <button
                                              onClick={() => deleteNote(note.id)}
                                              className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition duration-200 transform hover:scale-110"
                                              title="Delete"
                                          >
                                              <Trash2 className="w-5 h-5" />
                                          </button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
              )}

              {/* Content for Reminders Tab */}
              {activeTab === 'reminders' && (
                  <div className="space-y-6">
                      <div className="flex flex-col gap-4 items-center bg-gray-50 p-6 rounded-2xl shadow-lg border border-gray-100">
                          <input
                              type="text"
                              placeholder="Reminder text..."
                              className="flex-grow p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full transition duration-200"
                              value={newReminderText}
                              onChange={(e) => setNewReminderText(e.target.value)}
                          />
                          <div className="flex flex-col sm:flex-row w-full gap-4">
                              <input
                                  type="date"
                                  className="p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full sm:w-1/2 transition duration-200"
                                  value={newReminderDate}
                                  onChange={(e) => setNewReminderDate(e.target.value)}
                              />
                              <input
                                  type="time"
                                  className="p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full sm:w-1/2 transition duration-200"
                                  value={newReminderTime}
                                  onChange={(e) => setNewReminderTime(e.target.value)}
                              />
                          </div>
                          <button
                              onClick={addReminder}
                              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-indigo-700 transition duration-200 transform hover:scale-105 text-lg font-semibold flex items-center justify-center"
                          >
                              <Plus className="mr-2 w-5 h-5" /> Add Reminder
                          </button>
                      </div>

                      {reminders.length === 0 ? (
                          <p className="text-center text-gray-500 text-lg py-8 bg-white rounded-xl shadow-md border border-gray-100">No reminders set yet. Stay organized!</p>
                      ) : (
                          <ul className="space-y-4">
                              {reminders.map((reminder) => (
                                  <li key={reminder.id} className="flex flex-col bg-white p-4 rounded-xl shadow-md border border-gray-100 group hover:shadow-lg transition duration-200">
                                      {editingReminderId === reminder.id ? (
                                          <>
                                              <input
                                                  type="text"
                                                  value={editingReminderText}
                                                  onChange={(e) => setEditingReminderText(e.target.value)}
                                                  className="flex-grow p-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full mb-2"
                                                  autoFocus
                                              />
                                              <div className="flex flex-col sm:flex-row w-full gap-2 mb-2">
                                                  <input
                                                      type="date"
                                                      value={editingReminderDate}
                                                      onChange={(e) => setEditingReminderDate(e.target.value)}
                                                      className="p-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full sm:w-1/2"
                                                  />
                                                  <input
                                                      type="time"
                                                      value={editingReminderTime}
                                                      onChange={(e) => setEditingReminderTime(e.target.value)}
                                                      className="p-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg w-full sm:w-1/2"
                                                  />
                                              </div>
                                              <div className="flex justify-end space-x-2">
                                                  <button
                                                      onClick={() => updateReminder(reminder.id)}
                                                      className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition duration-200 transform hover:scale-110"
                                                      title="Save"
                                                  >
                                                      <Check className="w-5 h-5" />
                                                  </button>
                                                  <button
                                                      onClick={() => setEditingReminderId(null)}
                                                      className="p-2 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition duration-200 transform hover:scale-110"
                                                      title="Cancel"
                                                  >
                                                      <X className="w-5 h-5" />
                                                  </button>
                                              </div>
                                          </>
                                      ) : (
                                          <>
                                              <span className="flex-grow text-lg sm:text-xl font-medium text-gray-800">{reminder.text}</span>
                                              <p className="text-sm text-gray-500 mt-1 flex items-center">
                                                  <Calendar className="w-4 h-4 mr-1" />
                                                  {formatDate(reminder.reminderDate)} at {reminder.reminderTime}
                                              </p>
                                              <div className="flex justify-end space-x-2 mt-4">
                                                  <button
                                                      onClick={() => startEditingReminder(reminder)}
                                                      className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition duration-200 transform hover:scale-110"
                                                      title="Edit"
                                                  >
                                                      <Edit className="w-5 h-5" />
                                                  </button>
                                                  <button
                                                      onClick={() => deleteReminder(reminder.id)}
                                                      className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition duration-200 transform hover:scale-110"
                                                      title="Delete"
                                                  >
                                                      <Trash2 className="w-5 h-5" />
                                                  </button>
                                              </div>
                                          </>
                                      )}
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
              )}

              {/* Content for AI Assistant Tab */}
              {activeTab === 'ai' && (
                  <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-2xl shadow-lg border border-gray-100">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                              <Lightbulb className="w-6 h-6 mr-2 text-yellow-500" /> AI Assistant
                          </h2>
                          <textarea
                              ref={aiInputRef}
                              placeholder="Enter text for the AI (e.g., 'Summarize this idea: ...' or 'Expand on this plan: ...')"
                              rows="6"
                              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg resize-y mb-4 transition duration-200"
                              value={aiInput}
                              onChange={(e) => setAiInput(e.target.value)}
                          ></textarea>
                          <button
                              onClick={generateAIResponse}
                              disabled={aiLoading}
                              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-sky-600 text-white rounded-lg shadow-md hover:from-blue-600 hover:to-sky-700 transition duration-200 transform hover:scale-105 text-lg font-semibold flex items-center justify-center"
                          >
                              {aiLoading ? (
                                  <>
                                      <Loader2 className="animate-spin mr-2" /> Generating...
                                  </>
                              ) : (
                                  <>
                                      <Send className="mr-2" /> Get AI Response
                                  </>
                              )}
                          </button>
                      </div>

                      {aiResponse && (
                          <div className="bg-blue-50 p-6 rounded-2xl shadow-lg border border-blue-200 mt-6 animate-fade-in">
                              <h3 className="text-xl font-bold text-blue-800 mb-3 flex items-center">
                                  <Lightbulb className="w-5 h-5 mr-2 text-blue-400" /> AI Response:
                              </h3>
                              <div className="prose max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</div>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
  );
};

export default App;