import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import toast from 'react-hot-toast';

const STATUS_FILTERS = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'draft', label: 'Draft', icon: '📄' },
  { value: 'pending', label: 'Pending', icon: '⏳' },
  { value: 'signed', label: 'Signed', icon: '✅' },
  { value: 'rejected', label: 'Rejected', icon: '❌' },
];

const STATUS_STYLES = {
  draft: 'status-draft',
  pending: 'status-pending',
  signed: 'status-signed',
  rejected: 'status-rejected',
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await API.get(`/docs?status=${filter}`);
      setDocuments(data);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a PDF file');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name.replace('.pdf', ''));

    setUploading(true);
    try {
      await API.post('/docs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded successfully!');
      setShowUpload(false);
      setSelectedFile(null);
      setUploadTitle('');
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/docs/${id}`);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleDownloadSigned = async (id, fileName) => {
    try {
      const response = await API.get(`/docs/${id}/signed`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `signed_${fileName}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download signed document');
    }
  };

  const counts = {
    all: documents.length,
    draft: documents.filter(d => d.status === 'draft').length,
    pending: documents.filter(d => d.status === 'pending').length,
    signed: documents.filter(d => d.status === 'signed').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-mesh">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow">
                <span className="text-lg">📝</span>
              </div>
              <h1 className="text-xl font-bold gradient-text hidden sm:block">DocSign</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-dark-400 text-sm hidden sm:block">
                {user?.name}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-dark-400 hover:text-white bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition-all duration-200 border border-dark-700/30"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="content-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-slide-up">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
            </h2>
            <p className="text-dark-400 mt-1">Manage your documents and signatures</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary flex items-center gap-2"
            id="upload-document-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {[
            { label: 'Total', value: counts.all, color: 'from-primary-500 to-primary-700', icon: '📋' },
            { label: 'Pending', value: counts.pending, color: 'from-amber-500 to-orange-600', icon: '⏳' },
            { label: 'Signed', value: counts.signed, color: 'from-emerald-500 to-green-600', icon: '✅' },
            { label: 'Rejected', value: counts.rejected, color: 'from-red-500 to-rose-600', icon: '❌' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card-light p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-dark-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                filter === f.value
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'bg-dark-800/30 text-dark-400 border border-dark-700/30 hover:bg-dark-700/30 hover:text-dark-200'
              }`}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-white mb-2">No documents yet</h3>
            <p className="text-dark-400 mb-6">Upload your first PDF to get started</p>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              Upload Document
            </button>
          </div>
        ) : (
          <div className="grid gap-4 animate-fade-in">
            {documents.map((doc, index) => (
              <div
                key={doc._id}
                className="glass-card-light p-5 hover:border-primary-500/30 transition-all duration-300 group cursor-pointer"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0" onClick={() => navigate(`/document/${doc._id}`)}>
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-xl flex items-center justify-center shrink-0 border border-primary-500/20">
                      <span className="text-xl">📄</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-semibold truncate group-hover:text-primary-400 transition-colors">
                        {doc.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-dark-400 text-xs">{formatDate(doc.createdAt)}</span>
                        <span className="text-dark-600 text-xs">•</span>
                        <span className="text-dark-400 text-xs">{formatFileSize(doc.fileSize)}</span>
                        <span className="text-dark-600 text-xs">•</span>
                        <span className="text-dark-400 text-xs">{doc.totalPages} page{doc.totalPages > 1 ? 's' : ''}</span>
                        {doc.signerEmail && (
                          <>
                            <span className="text-dark-600 text-xs">•</span>
                            <span className="text-dark-400 text-xs">→ {doc.signerEmail}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                    
                    {doc.status === 'signed' && doc.signedFilePath && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadSigned(doc._id, doc.fileName); }}
                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Download signed PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/document/${doc._id}`); }}
                      className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                      title="View document"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc._id, doc.title); }}
                      className="p-2 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-8 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Upload Document</h3>
              <button
                onClick={() => { setShowUpload(false); setSelectedFile(null); setUploadTitle(''); }}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-5">
              <div>
                <label htmlFor="doc-title" className="label-text">Document Title</label>
                <input
                  id="doc-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Contract Agreement"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-text">PDF File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center cursor-pointer
                             hover:border-primary-500/50 hover:bg-primary-500/5 transition-all duration-300"
                >
                  {selectedFile ? (
                    <div>
                      <div className="text-4xl mb-2">📄</div>
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-dark-400 text-sm mt-1">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-dark-300 font-medium">Click to select PDF</p>
                      <p className="text-dark-500 text-sm mt-1">Max file size: 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="hidden"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setSelectedFile(null); setUploadTitle(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
