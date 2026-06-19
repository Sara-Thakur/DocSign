import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const STATUS_STYLES = {
  draft: 'status-draft',
  pending: 'status-pending',
  signed: 'status-signed',
  rejected: 'status-rejected',
};

const ACTION_LABELS = {
  document_uploaded: { label: 'Uploaded', icon: '📤', color: 'text-blue-400' },
  document_viewed: { label: 'Viewed', icon: '👁️', color: 'text-dark-300' },
  document_deleted: { label: 'Deleted', icon: '🗑️', color: 'text-red-400' },
  signature_placed: { label: 'Signature Placed', icon: '✍️', color: 'text-amber-400' },
  signature_signed: { label: 'Signed', icon: '✅', color: 'text-emerald-400' },
  signature_rejected: { label: 'Rejected', icon: '❌', color: 'text-red-400' },
  document_shared: { label: 'Shared', icon: '🔗', color: 'text-purple-400' },
  document_finalized: { label: 'Finalized', icon: '🏁', color: 'text-emerald-400' },
  public_link_accessed: { label: 'Link Accessed', icon: '🌐', color: 'text-blue-400' },
  email_sent: { label: 'Email Sent', icon: '📧', color: 'text-indigo-400' },
};

export default function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState('');
  const [activeTab, setActiveTab] = useState('signatures');
  const [showAddSig, setShowAddSig] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const pdfContainerRef = useRef(null);
  const [placingSignature, setPlacingSignature] = useState(false);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const updateWidth = () => {
      if (pdfContainerRef.current) {
        setContainerWidth(pdfContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docRes, sigRes, auditRes] = await Promise.all([
        API.get(`/docs/${id}`),
        API.get(`/signatures/${id}`),
        API.get(`/audit/${id}`),
      ]);
      setDoc(docRes.data);
      setSignatures(sigRes.data);
      setAuditLogs(auditRes.data);

      const token = JSON.parse(localStorage.getItem('docsign_user'))?.token;
      setPdfUrl(`/api/docs/${id}/file?token=${token}`);
    } catch (error) {
      toast.error('Failed to load document');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfClick = useCallback((e) => {
    if (!placingSignature || !pdfContainerRef.current) return;

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp values
    const clampedX = Math.max(0, Math.min(80, x));
    const clampedY = Math.max(0, Math.min(92, y));

    handleAddSignature(clampedX, clampedY);
  }, [placingSignature, signerName, signerEmail, currentPage]);

  const handleAddSignature = async (x, y) => {
    if (!signerName || !signerEmail) {
      toast.error('Please fill signer name and email first');
      return;
    }

    try {
      await API.post('/signatures', {
        documentId: id,
        signerName,
        signerEmail,
        x,
        y,
        page: currentPage,
        width: 20,
        height: 8,
      });
      toast.success('Signature field placed!');
      setPlacingSignature(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to place signature');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const { data } = await API.post('/signatures/share', { documentId: id });
      setShareLink(data.signLink);
      toast.success('Signing link sent via email!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteSignature = async (sigId) => {
    try {
      await API.delete(`/signatures/${sigId}`);
      toast.success('Signature field removed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="min-h-screen bg-mesh">
      {/* Top Bar */}
      <nav className="sticky top-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-white truncate max-w-xs sm:max-w-md">{doc.title}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
                {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {signatures.length > 0 && doc.status !== 'signed' && (
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                >
                  {sharing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  )}
                  Share & Send
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PDF Viewer — Left/Center */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden">
              {/* PDF Page Controls */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 text-dark-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-dark-700/50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-dark-300 text-sm">
                    Page {currentPage} of {numPages || '?'}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                    disabled={currentPage >= (numPages || 1)}
                    className="p-1.5 text-dark-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-dark-700/50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {placingSignature && (
                  <span className="text-amber-400 text-sm animate-pulse-subtle flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    Click on PDF to place signature
                  </span>
                )}
              </div>

              {/* PDF Content */}
              <div
                ref={pdfContainerRef}
                className={`relative bg-dark-950/50 ${placingSignature ? 'cursor-crosshair' : ''}`}
                onClick={handlePdfClick}
                style={{ minHeight: '500px' }}
              >
                <Document
                  file={pdfUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center py-20">
                      <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center py-20 text-red-400">
                      Failed to load PDF
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={containerWidth - 2}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>

                {/* Signature Overlays */}
                {signatures
                  .filter(s => s.page === currentPage)
                  .map(sig => (
                    <div
                      key={sig._id}
                      className={`absolute border-2 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200
                        ${sig.status === 'signed'
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                          : sig.status === 'rejected'
                          ? 'border-red-500/60 bg-red-500/10 text-red-400'
                          : 'border-amber-500/60 bg-amber-500/10 text-amber-400 border-dashed'
                        }`}
                      style={{
                        left: `${sig.x}%`,
                        top: `${sig.y}%`,
                        width: `${sig.width}%`,
                        height: `${sig.height}%`,
                      }}
                    >
                      {sig.status === 'signed' ? '✅ ' : sig.status === 'rejected' ? '❌ ' : '✍️ '}
                      {sig.signerName}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Tab Switcher */}
            <div className="glass-card-light p-1 flex gap-1">
              {['signatures', 'audit'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {tab === 'signatures' ? '✍️ Signatures' : '📋 Audit Trail'}
                </button>
              ))}
            </div>

            {/* Signatures Tab */}
            {activeTab === 'signatures' && (
              <div className="space-y-4 animate-fade-in">
                {/* Add Signature Section */}
                {doc.status !== 'signed' && (
                  <div className="glass-card p-5">
                    <h3 className="text-white font-semibold mb-4">Add Signature Field</h3>
                    {!showAddSig ? (
                      <button
                        onClick={() => setShowAddSig(true)}
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Signer
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          placeholder="Signer's full name"
                          className="input-field text-sm"
                        />
                        <input
                          type="email"
                          value={signerEmail}
                          onChange={(e) => setSignerEmail(e.target.value)}
                          placeholder="Signer's email"
                          className="input-field text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowAddSig(false); setPlacingSignature(false); }}
                            className="btn-secondary text-sm py-2 flex-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (!signerName || !signerEmail) {
                                toast.error('Fill in name and email');
                                return;
                              }
                              setPlacingSignature(true);
                              toast('Click on the PDF to place the signature field', { icon: '✍️' });
                            }}
                            className="btn-primary text-sm py-2 flex-1"
                          >
                            Place on PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Signature List */}
                <div className="glass-card p-5">
                  <h3 className="text-white font-semibold mb-3">Signature Fields ({signatures.length})</h3>
                  {signatures.length === 0 ? (
                    <p className="text-dark-500 text-sm">No signature fields added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {signatures.map(sig => (
                        <div key={sig._id} className="flex items-center justify-between p-3 bg-dark-800/30 rounded-xl border border-dark-700/30">
                          <div>
                            <p className="text-white text-sm font-medium">{sig.signerName}</p>
                            <p className="text-dark-400 text-xs">{sig.signerEmail}</p>
                            <p className="text-dark-500 text-xs mt-1">Page {sig.page}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sig.status]}`}>
                              {sig.status}
                            </span>
                            {sig.status === 'pending' && doc.status !== 'signed' && (
                              <button
                                onClick={() => handleDeleteSignature(sig._id)}
                                className="p-1 text-dark-500 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share Link Display */}
                {shareLink && (
                  <div className="glass-card p-5">
                    <h3 className="text-white font-semibold mb-3">🔗 Share Link</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="input-field text-sm flex-1 text-dark-300"
                      />
                      <button onClick={copyShareLink} className="btn-primary text-sm py-2 px-4">
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === 'audit' && (
              <div className="glass-card p-5 animate-fade-in">
                <h3 className="text-white font-semibold mb-4">📋 Audit Trail</h3>
                {auditLogs.length === 0 ? (
                  <p className="text-dark-500 text-sm">No activity recorded yet</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {auditLogs.map((log, i) => {
                      const info = ACTION_LABELS[log.action] || { label: log.action, icon: '📌', color: 'text-dark-300' };
                      return (
                        <div key={log._id || i} className="flex gap-3 pb-3 border-b border-dark-700/20 last:border-0">
                          <div className="shrink-0 mt-0.5">
                            <span className="text-lg">{info.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${info.color}`}>{info.label}</p>
                            <p className="text-dark-400 text-xs mt-0.5">{log.performedBy}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-dark-500 text-xs">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                              {log.ipAddress && log.ipAddress !== 'unknown' && (
                                <span className="text-dark-600 text-xs">IP: {log.ipAddress}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
