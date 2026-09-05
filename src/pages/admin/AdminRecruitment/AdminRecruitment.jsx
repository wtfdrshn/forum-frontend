import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { canView } from '../../../utils/permissions';
import './AdminRecruitment.css';
import api from '../../../utils/api';
import Loader from '../../../components/loader/Loader';

const AdminRecruitment = () => {
  const { AuthorizationToken, user, isLoading } = useAuth();
  const [recruitments, setRecruitments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recruitments');
  const [showForm, setShowForm] = useState(false);
  const [editingRecruitment, setEditingRecruitment] = useState(null);
  const [selectedRecruitment, setSelectedRecruitment] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationsPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [questionFilter, setQuestionFilter] = useState({
    questionIndex: '',
    answerValue: ''
  });
  const [choiceQuestions, setChoiceQuestions] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isActive: false,
    applicationDeadline: '',
    maxApplications: 100,
    customQuestions: [],
    successMessage: 'Thank you for your application! We will get back to you soon.',
    closedMessage: 'Recruitment is currently closed. Please check back later.',
    whatsappGroupUrl: ''
  });

  const [questionForm, setQuestionForm] = useState({
    question: '',
    type: 'text',
    options: [],
    required: false,
    allowMultiple: false,
    placeholder: '',
    showIf: null
  });
  const [editingQuestionIndexLocal, setEditingQuestionIndexLocal] = useState(null);
  const [editingOptionIndex, setEditingOptionIndex] = useState(null);
  const questionsListRef = useRef(null);
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inlineEditRef = useRef(null);

  useEffect(() => {
    fetchRecruitments();
  }, []);

  const fetchRecruitments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/recruitment/admin/all');
      setRecruitments(response.data.data);
    } catch (error) {
      console.error('Error fetching recruitments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async (recruitmentId, page = 1, search = '', questionFilterData = null) => {
    try {
      const params = {
        page,
        limit: applicationsPerPage
      };
      if (search) {
        params.search = search;
      }
      if (questionFilterData && questionFilterData.questionIndex !== '' && questionFilterData.answerValue !== '') {
        params.questionIndex = questionFilterData.questionIndex;
        params.answerValue = questionFilterData.answerValue;
      }
      
      const response = await api.get(`/recruitment/admin/applications/${recruitmentId}`, { params });
      setApplications(response.data.data.applications);
      setPagination(response.data.data.pagination || {
        current: page,
        pages: 1,
        total: response.data.data.applications.length
      });
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedRecruitment) {
      setCurrentPage(1);
      fetchApplications(selectedRecruitment._id, 1, searchQuery, questionFilter);
    }
  };

  const handleQuestionFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilter = {
      ...questionFilter,
      [name]: value
    };
    // Reset answerValue when question changes
    if (name === 'questionIndex') {
      newFilter.answerValue = '';
    }
    setQuestionFilter(newFilter);
    
    if (selectedRecruitment) {
      setCurrentPage(1);
      fetchApplications(selectedRecruitment._id, 1, searchQuery, newFilter);
    }
  };

  const clearQuestionFilter = () => {
    const clearedFilter = { questionIndex: '', answerValue: '' };
    setQuestionFilter(clearedFilter);
    if (selectedRecruitment) {
      setCurrentPage(1);
      fetchApplications(selectedRecruitment._id, 1, searchQuery, clearedFilter);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    // Optional: Clear search when input is empty
    if (e.target.value === '' && selectedRecruitment) {
      setCurrentPage(1);
      fetchApplications(selectedRecruitment._id, 1, '');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleQuestionChange = (e) => {
    const { name, value, type, checked } = e.target;
    setQuestionForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addQuestion = () => {
    if (!questionForm.question.trim()) return;

    const newQuestion = {
      ...questionForm
    };
    
    if (editingQuestionIndexLocal !== null) {
      // Update existing question
      setFormData(prev => ({
        ...prev,
        customQuestions: prev.customQuestions.map((q, i) => i === editingQuestionIndexLocal ? newQuestion : q)
      }));
      setEditingQuestionIndexLocal(null);
    } else {
      // Add new question
      setFormData(prev => ({
      ...prev,
      customQuestions: [...prev.customQuestions, newQuestion]
    }));
    // Auto-scroll to the new question in the list
    setTimeout(() => {
      if (questionsListRef.current) {
        const items = questionsListRef.current.querySelectorAll('.question-item');
        if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    }

    setQuestionForm({
      question: '',
      type: 'text',
      options: [],
      required: false,
      allowMultiple: false,
      placeholder: '',
      showIf: null
    });
  };

  // Rebuild showIf.questionIndex values after reorder using an old→new index map
  const remapShowIfIndices = (questions, indexMap) => {
    return questions.map(q => {
      if (!q.showIf || q.showIf.questionIndex == null) return q;
      const newIdx = indexMap[q.showIf.questionIndex];
      if (newIdx === undefined || newIdx === null) return { ...q, showIf: null }; // parent was removed
      return { ...q, showIf: { ...q.showIf, questionIndex: newIdx } };
    });
  };

  const removeQuestion = (index) => {
    // Build index map: remove index, shift everything above it down
    const questions = formData.customQuestions;
    const indexMap = {};
    for (let i = 0; i < questions.length; i++) {
      if (i === index) indexMap[i] = null; // removed
      else if (i > index) indexMap[i] = i - 1;
      else indexMap[i] = i;
    }
    const updated = questions.filter((_, i) => i !== index);
    const remapped = remapShowIfIndices(updated, indexMap);
    setFormData(prev => ({ ...prev, customQuestions: remapped }));
    if (editingQuestionIndexLocal === index) {
      setEditingQuestionIndexLocal(null);
      setQuestionForm({ question: '', type: 'text', options: [], required: false, allowMultiple: false, placeholder: '', showIf: null });
    }
  };

  const moveQuestion = (index, direction) => {
    const questions = [...formData.customQuestions];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    // Build index map for swap
    const indexMap = {};
    for (let i = 0; i < questions.length; i++) {
      if (i === index) indexMap[i] = targetIndex;
      else if (i === targetIndex) indexMap[i] = index;
      else indexMap[i] = i;
    }
    [questions[index], questions[targetIndex]] = [questions[targetIndex], questions[index]];
    const remapped = remapShowIfIndices(questions, indexMap);
    setFormData(prev => ({ ...prev, customQuestions: remapped }));
  };

  const editQuestion = (index) => {
    const q = formData.customQuestions[index];
    setQuestionForm({
      question: q.question || '',
      type: q.type || 'text',
      options: Array.isArray(q.options) ? q.options : [],
      required: !!q.required,
      allowMultiple: !!q.allowMultiple,
      placeholder: q.placeholder || '',
      showIf: q.showIf || null
    });
    setEditingQuestionIndexLocal(index);
    // Scroll to inline editor after it renders
    setTimeout(() => {
      if (inlineEditRef.current) {
        inlineEditRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inlineEditRef.current.querySelector('input,textarea,select')?.focus();
      }
    }, 50);
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const updateOption = (index, value) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingRecruitment 
        ? `/recruitment/admin/update/${editingRecruitment._id}`
        : '/recruitment/admin/create';

      // Clean the form data to remove any _id fields from custom questions
      const cleanedFormData = {
        ...formData,
        customQuestions: formData.customQuestions.map(q => {
          const { _id, ...cleanQuestion } = q;
          return cleanQuestion;
        })
      };

      const response = editingRecruitment 
        ? await api.put(url, cleanedFormData)
        : await api.post(url, cleanedFormData);
      
      if (response.data.success) {
        alert(editingRecruitment ? 'Recruitment updated successfully' : 'Recruitment created successfully');
        fetchRecruitments();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving recruitment:', error);
      alert('Error saving recruitment');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      isActive: false,
      applicationDeadline: '',
      maxApplications: 100,
      customQuestions: [],
      successMessage: 'Thank you for your application! We will get back to you soon.',
      closedMessage: 'Recruitment is currently closed. Please check back later.',
      whatsappGroupUrl: ''
    });
    setEditingRecruitment(null);
    setShowForm(false);
  };

  const editRecruitment = (recruitment) => {
    setFormData({
      ...recruitment,
      applicationDeadline: recruitment.applicationDeadline ? 
        new Date(recruitment.applicationDeadline).toISOString().split('T')[0] : ''
    });
    setEditingRecruitment(recruitment);
    setShowForm(true);
  };

  const duplicateRecruitment = (recruitment) => {
    const { _id, ...rest } = recruitment;
    setFormData({
      ...rest,
      title: `${recruitment.title} (Copy)`,
      applicationDeadline: recruitment.applicationDeadline ? 
        new Date(recruitment.applicationDeadline).toISOString().split('T')[0] : ''
    });
    setEditingRecruitment(null);
    setShowForm(true);
  };

  const deleteRecruitment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recruitment?')) return;

    try {
      await api.delete(`/recruitment/admin/delete/${id}`);
      alert('Recruitment deleted successfully');
      fetchRecruitments();
    } catch (error) {
      console.error('Error deleting recruitment:', error);
      alert('Error deleting recruitment');
    }
  };

  const updateApplicationStatus = async (applicationId, status) => {
    try {
      await api.put(`/recruitment/admin/application/${applicationId}/status`, { status });
      alert('Application status updated successfully');
      if (selectedRecruitment) {
        fetchApplications(selectedRecruitment._id, currentPage, searchQuery, questionFilter);
      }
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('Error updating application status');
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="admin-recruitment">
      <div className="admin-header-recruitment">
        <h1>Recruitment Management</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Create New Recruitment
        </button>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'recruitments' ? 'active' : ''}`}
          onClick={() => setActiveTab('recruitments')}
        >
          Recruitments
        </button>
        <button 
          className={`tab ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          Applications
        </button>
      </div>

      {activeTab === 'recruitments' && (
        <div className="recruitments-section">
          {recruitments.length === 0 ? (
            <div className="empty-state">
              <p>No recruitments found. Create your first recruitment!</p>
            </div>
          ) : (
            <div className="recruitments-grid">
              {recruitments.map(recruitment => (
                <div key={recruitment._id} className="recruitment-card">
                  <div className="recruitment-header">
                    <h3>{recruitment.title}</h3>
                    <div className={`status ${recruitment.isActive ? 'active' : 'inactive'}`}>
                      {recruitment.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <p className="description-recruitment">{recruitment.description.slice(0, 100)}...</p>
                  <div className="recruitment-stats">
                    <p>Applications: {recruitment.currentApplications}/{recruitment.maxApplications}</p>
                    <p>Deadline: {new Date(recruitment.applicationDeadline).toLocaleDateString()}</p>
                    <p>Questions: {recruitment.customQuestions.length}</p>
                  </div>
                  <div className="recruitment-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => editRecruitment(recruitment)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => duplicateRecruitment(recruitment)}
                    >
                      Duplicate
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedRecruitment(recruitment);
                        setCurrentPage(1);
                        setSearchQuery('');
                        setQuestionFilter({ questionIndex: '', answerValue: '' });
                        // Extract choice-based questions (dropdown, radio, checkbox)
                        const choiceBased = recruitment.customQuestions
                          .map((q, idx) => ({ ...q, index: idx }))
                          .filter(q => ['dropdown', 'radio', 'checkbox'].includes(q.type));
                        setChoiceQuestions(choiceBased);
                        fetchApplications(recruitment._id, 1, '', null);
                        setActiveTab('applications');
                      }}
                    >
                      View Applications
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={() => deleteRecruitment(recruitment._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="applications-section">
          {selectedRecruitment && (
            <div className="selected-recruitment" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3>Applications for: {selectedRecruitment.title}</h3>
              <a
                href={`${import.meta.env.VITE_SERVER_URL || 'https://server.snsf.live'}/api/v1/recruitment/admin/applications/${selectedRecruitment._id}/export`}
                download
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(e.currentTarget.href, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Export failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const disposition = res.headers.get('Content-Disposition') || '';
                    const match = disposition.match(/filename="(.+?)"/);
                    a.download = match ? match[1] : 'applications.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Failed to export CSV. Please try again.');
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', cursor: 'pointer' }}
              >
                ⬇ Export CSV
              </a>
            </div>
          )}

          {selectedRecruitment && (
            <div className="applications-search-bar">
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by name or PRN..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <button type="submit" className="btn-secondary search-button">
                  Search
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    className="btn-secondary clear-search-button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                      fetchApplications(selectedRecruitment._id, 1, '', questionFilter);
                    }}
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>
          )}

          {selectedRecruitment && choiceQuestions.length > 0 && (
            <div className="applications-filter-bar">
              <h4>Filter by Question:</h4>
              <div className="filter-form">
                <select
                  className="filter-select"
                  name="questionIndex"
                  value={questionFilter.questionIndex}
                  onChange={handleQuestionFilterChange}
                >
                  <option value="">Select a question...</option>
                  {choiceQuestions.map((q) => (
                    <option key={q.index} value={q.index}>
                      {q.question}
                    </option>
                  ))}
                </select>

                {questionFilter.questionIndex !== '' && (
                  <>
                    <select
                      className="filter-select"
                      name="answerValue"
                      value={questionFilter.answerValue}
                      onChange={handleQuestionFilterChange}
                    >
                      <option value="">Select an answer...</option>
                      {choiceQuestions
                        .find(q => q.index === parseInt(questionFilter.questionIndex))
                        ?.options.map((option, idx) => (
                          <option key={idx} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary clear-filter-button"
                      onClick={clearQuestionFilter}
                    >
                      Clear Filter
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          
          {applications.length === 0 ? (
            <div className="empty-state">
              <p>{searchQuery ? 'No applications found matching your search.' : 'No applications found for this recruitment.'}</p>
            </div>
          ) : (
            <>
            <div className="applications-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                      <th>Course</th>
                      <th>Year</th>
                      <th>PRN</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(application => (
                    <tr 
                      key={application._id}
                      className="clickable-row"
                      onClick={() => {
                        setSelectedApplication(application);
                        setShowApplicationModal(true);
                      }}
                    >
                      <td>{application.applicantInfo?.name}</td>
                      <td>{application.applicantInfo?.email}</td>
                        <td>{application.applicantInfo?.course || 'N/A'}</td>
                        <td>{application.applicantInfo?.year || 'N/A'}</td>
                        <td>{application.applicantInfo?.prn || 'N/A'}</td>
                      <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              
              {pagination.pages > 1 && (
                <div className="admin-pagination">
                  <button 
                    className="page-button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      const newPage = currentPage - 1;
                      fetchApplications(selectedRecruitment._id, newPage, searchQuery);
                    }}
                  >
                    Previous
                  </button>
                  
                  <div className="page-numbers">
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(number => (
                      <button
                        key={number}
                        className={`page-number ${currentPage === number ? 'active' : ''}`}
                        onClick={() => {
                          fetchApplications(selectedRecruitment._id, number, searchQuery, questionFilter);
                        }}
                      >
                        {number}
                      </button>
                    ))}
                  </div>

                  <button 
                    className="page-button"
                    disabled={currentPage === pagination.pages}
                    onClick={() => {
                      const newPage = currentPage + 1;
                      fetchApplications(selectedRecruitment._id, newPage, searchQuery, questionFilter);
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="admin-modal">
            <div className="modal-header">
              <h2>{editingRecruitment ? 'Edit Recruitment' : 'Create New Recruitment'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="admin-recruitment-form">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Application Deadline *</label>
                  <input
                    type="date"
                    name="applicationDeadline"
                    value={formData.applicationDeadline}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Max Applications</label>
                  <input
                    type="number"
                    name="maxApplications"
                    value={formData.maxApplications}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group form-checkbox">
                <input
                  id="isActive"
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <label htmlFor="isActive">Activate this recruitment</label>
              </div>

              <div className="form-group">
                <label>Success Message</label>
                <textarea
                  name="successMessage"
                  value={formData.successMessage}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Closed Message</label>
                <textarea
                  name="closedMessage"
                  value={formData.closedMessage}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>WhatsApp Group Invite URL (optional)</label>
                <input
                  type="url"
                  name="whatsappGroupUrl"
                  value={formData.whatsappGroupUrl}
                  onChange={handleInputChange}
                  placeholder="https://chat.whatsapp.com/XXXXXX"
                />
              </div>

              <div className="questions-section">
                <h3>Custom Questions</h3>
                
                 <div className={`questions-list${isDragging ? ' is-dragging' : ''}`} ref={questionsListRef}>
                  {formData.customQuestions.map((question, index) => (
                    <React.Fragment key={index}>
                    <div
                      className={`question-item${
                        dragOverIndex === index ? ' drag-over' : ''
                      }${editingQuestionIndexLocal === index ? ' editing' : ''}${
                        isDragging && dragIndexRef.current === index ? ' dragging' : ''
                      }`}
                      draggable
                      onDragStart={(e) => {
                        dragIndexRef.current = index;
                        setIsDragging(true);
                        // Required for Firefox
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', index);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (dragIndexRef.current !== index) setDragOverIndex(index);
                      }}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragIndexRef.current;
                        const to = index;
                        if (from === null || from === to) { setDragOverIndex(null); setIsDragging(false); return; }
                        const questions = [...formData.customQuestions];
                        const n = questions.length;
                        // Build old→new index map for splice reorder
                        const indexMap = {};
                        for (let i = 0; i < n; i++) {
                          if (i === from) indexMap[i] = to;
                          else if (from < to && i > from && i <= to) indexMap[i] = i - 1;
                          else if (from > to && i >= to && i < from) indexMap[i] = i + 1;
                          else indexMap[i] = i;
                        }
                        const [moved] = questions.splice(from, 1);
                        questions.splice(to, 0, moved);
                        const remapped = remapShowIfIndices(questions, indexMap);
                        setFormData(prev => ({ ...prev, customQuestions: remapped }));
                        dragIndexRef.current = null;
                        setDragOverIndex(null);
                        setIsDragging(false);
                      }}
                      onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); setIsDragging(false); }}
                    >
                      <span className="drag-handle" title="Drag to reorder">⠿</span>
                      <div className="question-content">
                        <span className="question-index">Q{index + 1}</span>
                        <strong>{question.question}</strong>
                        <span className="question-type">({question.type}{question.allowMultiple ? ', multi' : ''})</span>
                        {question.required && <span className="required">*</span>}
                        {question.showIf && (
                          <span className="visibility-chip" title="Visibility rule">
                            Visible when Q{(question.showIf.questionIndex ?? 0) + 1} equals "{question.showIf.value}"
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex', gap:'0.4rem', alignItems:'center'}}>
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, -1)}
                          className="btn-move"
                          disabled={index === 0}
                          title="Move up"
                        >↑</button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 1)}
                          className="btn-move"
                          disabled={index === formData.customQuestions.length - 1}
                          title="Move down"
                        >↓</button>
                        <button
                          type="button"
                          onClick={() => editQuestion(index)}
                          className="btn-secondary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="remove-question"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form — appears right below the card being edited */}
                    {editingQuestionIndexLocal === index && (
                      <div className="question-builder question-builder-inline" ref={inlineEditRef}>
                        <div className="inline-edit-header">✏️ Editing Q{index + 1}</div>
                        <div className="form-group">
                          <label>Question</label>
                          <input
                            type="text"
                            value={questionForm.question}
                            onChange={(e) => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                            placeholder="Enter your question"
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Type</label>
                            <select value={questionForm.type} onChange={handleQuestionChange} name="type">
                              <option value="text">Text Input</option>
                              <option value="textarea">Text Area</option>
                              <option value="email">Email</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="radio">Radio Buttons</option>
                              <option value="checkbox">Checkboxes</option>
                            </select>
                          </div>
                          <div className="form-group form-checkbox">
                            <label htmlFor={`required-inline-${index}`}>
                              <input id={`required-inline-${index}`} type="checkbox" name="required" checked={questionForm.required} onChange={handleQuestionChange} />
                              <span> Required</span>
                            </label>
                          </div>
                          {questionForm.type === 'radio' && (
                            <div className="form-group form-checkbox">
                              <label htmlFor={`allowMultiple-inline-${index}`}>
                                <input id={`allowMultiple-inline-${index}`} type="checkbox" name="allowMultiple" checked={questionForm.allowMultiple} onChange={handleQuestionChange} />
                                <span> Allow Multiple Selections</span>
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Visibility (optional)</label>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Parent Question</label>
                              <select
                                value={questionForm.showIf?.questionIndex ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuestionForm(prev => ({
                                    ...prev,
                                    showIf: val === '' ? null : { questionIndex: Number(val), operator: 'equals', value: '' }
                                  }));
                                }}
                              >
                                <option value="">None</option>
                                {formData.customQuestions.map((q, idx) => (
                                  (q.type === 'dropdown' || q.type === 'radio') && idx !== index && (
                                    <option key={idx} value={idx}>{idx + 1}. {q.question}</option>
                                  )
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Value</label>
                              <select
                                value={questionForm.showIf?.value ?? ''}
                                onChange={(e) => setQuestionForm(prev => prev.showIf ? ({ ...prev, showIf: { ...prev.showIf, value: e.target.value } }) : prev)}
                                disabled={!(questionForm.showIf && (formData.customQuestions[questionForm.showIf.questionIndex]?.options?.length))}
                              >
                                <option value="">Select value</option>
                                {questionForm.showIf && formData.customQuestions[questionForm.showIf.questionIndex]?.options?.map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {(questionForm.type === 'dropdown' || questionForm.type === 'radio' || questionForm.type === 'checkbox') && (
                          <div className="form-group">
                            <label>Options <span style={{fontSize:'0.78rem',color:'#64748b',fontWeight:400}}>(double-click to rename)</span></label>
                            <div className="options-pill-row">
                              {questionForm.options.map((option, optIdx) => (
                                editingOptionIndex === optIdx
                                  ? <input
                                      key={optIdx}
                                      className="option-pill option-pill-editing"
                                      autoFocus
                                      defaultValue={option}
                                      onBlur={(e) => { updateOption(optIdx, e.target.value.trim() || option); setEditingOptionIndex(null); }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); updateOption(optIdx, e.target.value.trim() || option); setEditingOptionIndex(null); } if (e.key === 'Escape') setEditingOptionIndex(null); }}
                                    />
                                  : <span key={optIdx} className="option-pill" onDoubleClick={() => setEditingOptionIndex(optIdx)} title="Double-click to rename">
                                      {option || `Option ${optIdx + 1}`}
                                      <button type="button" className="pill-remove" onClick={() => removeOption(optIdx)}>×</button>
                                    </span>
                              ))}
                              <input
                                className="pill-input"
                                type="text"
                                placeholder="Type option and press Enter"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                      setQuestionForm(prev => ({ ...prev, options: [...prev.options, val] }));
                                      e.currentTarget.value = '';
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Placeholder</label>
                          <input type="text" name="placeholder" value={questionForm.placeholder} onChange={handleQuestionChange} placeholder="Enter placeholder text" />
                        </div>

                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <button type="button" onClick={addQuestion} className="add-question">Save Question</button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setEditingQuestionIndexLocal(null);
                              setQuestionForm({ question: '', type: 'text', options: [], required: false, allowMultiple: false, placeholder: '', showIf: null });
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Bottom builder — only shown when NOT editing an existing question */}
                {editingQuestionIndexLocal === null && (
                <div className="question-builder">
                  <div className="form-group">
                    <label>Question</label>
                    <input
                      type="text"
                      value={questionForm.question}
                      onChange={(e) => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                      placeholder="Enter your question"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={questionForm.type}
                        onChange={handleQuestionChange}
                        name="type"
                      >
                        <option value="text">Text Input</option>
                        <option value="textarea">Text Area</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="radio">Radio Buttons</option>
                        <option value="checkbox">Checkboxes</option>
                      </select>
                    </div>

                    <div className="form-group form-checkbox">
                      <label htmlFor="required">
                        <input
                          id="required"
                          type="checkbox"
                          name="required"
                          checked={questionForm.required}
                          onChange={handleQuestionChange}
                        />
                        <span> Required</span>
                      </label>
                    </div>

                    {questionForm.type === 'radio' && (
                      <div className="form-group form-checkbox">
                        <label htmlFor="allowMultiple">
                          <input
                            id="allowMultiple"
                            type="checkbox"
                            name="allowMultiple"
                            checked={questionForm.allowMultiple}
                            onChange={handleQuestionChange}
                          />
                          <span> Allow Multiple Selections</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Conditional visibility configuration */}
                  <div className="form-group">
                    <label>Visibility (optional)</label>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Parent Question</label>
                        <select
                          value={questionForm.showIf?.questionIndex ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestionForm(prev => ({
                              ...prev,
                              showIf: val === '' ? null : { questionIndex: Number(val), operator: 'equals', value: '' }
                            }));
                          }}
                        >
                          <option value="">None</option>
                          {formData.customQuestions.map((q, idx) => (
                            (q.type === 'dropdown' || q.type === 'radio') && (
                              <option key={idx} value={idx}>{idx + 1}. {q.question}</option>
                            )
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Operator</label>
                        <select
                          value={questionForm.showIf?.operator ?? 'equals'}
                          onChange={(e) => setQuestionForm(prev => prev.showIf ? ({ ...prev, showIf: { ...prev.showIf, operator: e.target.value } }) : prev)}
                          disabled={!questionForm.showIf}
                        >
                          <option value="equals">Equals</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Value</label>
                        <select
                          value={questionForm.showIf?.value ?? ''}
                          onChange={(e) => setQuestionForm(prev => prev.showIf ? ({ ...prev, showIf: { ...prev.showIf, value: e.target.value } }) : prev)}
                          disabled={!(questionForm.showIf && (formData.customQuestions[questionForm.showIf.questionIndex]?.options?.length))}
                        >
                          <option value="">Select value</option>
                          {questionForm.showIf && formData.customQuestions[questionForm.showIf.questionIndex]?.options?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {(questionForm.type === 'dropdown' || questionForm.type === 'radio' || questionForm.type === 'checkbox') && (
                    <div className="form-group">
                      <label>Options <span style={{fontSize:'0.78rem',color:'#64748b',fontWeight:400}}>(double-click a pill to rename)</span></label>
                      <div className="options-pill-row">
                        {questionForm.options.map((option, index) => (
                          editingOptionIndex === index
                            ? <input
                                key={index}
                                className="option-pill option-pill-editing"
                                autoFocus
                                defaultValue={option}
                                onBlur={(e) => { updateOption(index, e.target.value.trim() || option); setEditingOptionIndex(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); updateOption(index, e.target.value.trim() || option); setEditingOptionIndex(null); } if (e.key === 'Escape') setEditingOptionIndex(null); }}
                              />
                            : <span key={index} className="option-pill" onDoubleClick={() => setEditingOptionIndex(index)} title="Double-click to rename">
                                {option || `Option ${index + 1}`}
                                <button type="button" className="pill-remove" onClick={() => removeOption(index)}>×</button>
                              </span>
                        ))}
                        <input
                          className="pill-input"
                          type="text"
                          placeholder="Type option and press Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                setQuestionForm(prev => ({ ...prev, options: [...prev.options, val] }));
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Placeholder</label>
                    <input
                      type="text"
                      name="placeholder"
                      value={questionForm.placeholder}
                      onChange={handleQuestionChange}
                      placeholder="Enter placeholder text"
                    />
                  </div>

                  <div style={{display:'flex', gap:'0.5rem'}}>
                    <button type="button" onClick={addQuestion} className="add-question">
                      Add Question
                    </button>
                  </div>
                </div>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingRecruitment ? 'Update Recruitment' : 'Create Recruitment'}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showApplicationModal && selectedApplication && (
        <div className="modal-overlay" onClick={() => setShowApplicationModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Application</h2>
              <button className="close-btn" onClick={() => setShowApplicationModal(false)}>×</button>
            </div>
            <div className="application-details">
              <div className="applicant-info">
                <h3>{selectedApplication.applicantInfo?.name}</h3>
                <p>{selectedApplication.applicantInfo?.email}</p>
                <div className="applicant-meta">
                  <span>Course: {selectedApplication.applicantInfo?.course || 'Not specified'}</span>
                  <span>Year: {selectedApplication.applicantInfo?.year || 'Not specified'}</span>
                  <span>PRN: {selectedApplication.applicantInfo?.prn || 'Not specified'}</span>
                  <span>Gender: {selectedApplication.applicantInfo?.gender || 'Not specified'}</span>
                  <span>Submitted: {new Date(selectedApplication.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedApplication.answers && selectedApplication.answers.length > 0 && (
                <div className="answers-section">
                  <h4>Responses</h4>
                  <div className="answers-list">
                    {selectedApplication.answers
                      .filter(answer => answer.answer && answer.answer !== '' && 
                        (!Array.isArray(answer.answer) || answer.answer.length > 0))
                      .map((answer, idx) => (
                      <div key={idx} className="answer-item">
                        <div className="answer-question">{answer.question}</div>
                        <div className="answer-response">
                          {Array.isArray(answer.answer) ? 
                            answer.answer.join(', ') : 
                            String(answer.answer)
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowApplicationModal(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecruitment;
