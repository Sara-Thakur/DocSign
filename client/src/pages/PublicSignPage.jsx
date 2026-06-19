import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PublicSignPage() {
  const { token } = useParams();
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [signing, setSigning] = useState(false);
  const [showSignPad, setShowSignPad] = useState(null); // signature ID
  const [showReject, setShowReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [completed, setCompleted] = useState(false);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchDocument();
  }, [token]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.min(containerRef.current.offsetWidth - 2, 800));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const fetchDocument = async () => {
    try {
      const { data } = await axios.get(`/api/signatures/public/${token}`);
      setDocData(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired signing link');
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7c5cf2';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async (signatureId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas has content
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((val, i) => i % 4 === 3 && val > 0);

    if (!hasContent) {
      toast.error('Please draw your signature first');
      return;
    }

    setSigning(true);
    try {
      const signatureData = canvas.toDataURL('image/png');
      const { data } = await axios.post(`/api/signatures/public/${token}/sign`, {
        signatureId,
        signatureData,
        action: 'sign',
      });
      toast.success(data.message);
      if (data.status === 'signed') {
        setCompleted(true);
      }
      setShowSignPad(null);
      fetchDocument();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sign');
    } finally {
      setSigning(false);
    }
  };

  const handleReject = async (signatureId) => {
    setSigning(true);
    try {
      const { data } = await axios.post(`/api/signatures/public/${token}/sign`, {
        signatureId,
        action: 'reject',
        rejectionReason: rejectionReason || 'No reason provided',
      });
      toast.success('Document rejected');
      setShowReject(null);
      setRejectionReason('');
      fetchDocument();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-dark-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
        <div className="glass-card p-12 text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-dark-400">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
        <div className="glass-card p-12 text-center max-w-md animate-scale-in">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">Document Fully Signed!</h2>
          <p className="text-dark-400">All signatures have been recorded. The document owner has been notified.</p>
        </div>
      </div>
    );
  }

  const { document: docInfo, signatures, shareToken } = docData;
  const allProcessed = signatures.every(s => s.status !== 'pending');

  return (
    <div className="min-h-screen bg-mesh">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e1d2f',
            color: '#e2e2f0',
            border: '1px solid rgba(70, 68, 102, 0.5)',
            borderRadius: '12px',
          },
        }}
      />

      {/* Header */}
      <nav className="bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">DocSign</h1>
              <p className="text-dark-500 text-xs">Secure Document Signing</p>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Document Info */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{docInfo.title}</h2>
              <p className="text-dark-400 text-sm mt-1">Sent by <span className="text-primary-400">{docInfo.ownerName}</span></p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              docInfo.status === 'signed' ? 'status-signed' :
              docInfo.status === 'rejected' ? 'status-rejected' : 'status-pending'
            }`}>
              {docInfo.status}
            </span>
          </div>
        </div>

        {/* Notification for completed status */}
        {allProcessed && (
          <div className="glass-card p-6 mb-6 text-center animate-fade-in">
            <p className="text-lg">
              {docInfo.status === 'signed' ? '✅ This document has been signed' :
               docInfo.status === 'rejected' ? '❌ This document has been rejected' :
               '⏳ All signatures have been processed'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PDF Viewer */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden" ref={containerRef}>
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
                  <span className="text-dark-300 text-sm">Page {currentPage} of {numPages || '?'}</span>
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
              </div>

              <div className="relative bg-dark-950/50">
                <Document
                  file={`/api/docs/${docInfo._id}/file?token=${shareToken}`}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center py-20">
                      <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={containerWidth}
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
                      className={`absolute border-2 rounded-lg flex items-center justify-center text-xs font-medium
                        ${sig.status === 'signed'
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                          : sig.status === 'rejected'
                          ? 'border-red-500/60 bg-red-500/10 text-red-400'
                          : 'border-amber-500/60 bg-amber-500/10 text-amber-400 border-dashed animate-pulse-subtle'
                        }`}
                      style={{
                        left: `${sig.x}%`,
                        top: `${sig.y}%`,
                        width: `${sig.width}%`,
                        height: `${sig.height}%`,
                      }}
                    >
                      {sig.status === 'signed' ? '✅' : sig.status === 'rejected' ? '❌' : '✍️ Sign here'}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Signing Panel */}
          <div className="space-y-4">
            {signatures.map(sig => (
              <div key={sig._id} className="glass-card p-5 animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">{sig.signerName}</p>
                    <p className="text-dark-400 text-xs">{sig.signerEmail}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    sig.status === 'signed' ? 'status-signed' :
                    sig.status === 'rejected' ? 'status-rejected' : 'status-pending'
                  }`}>
                    {sig.status}
                  </span>
                </div>

                {sig.status === 'pending' && (
                  <div className="space-y-3">
                    {showSignPad === sig._id ? (
                      <>
                        <p className="text-dark-300 text-sm">Draw your signature below:</p>
                        <canvas
                          ref={canvasRef}
                          width={300}
                          height={150}
                          className="signature-canvas w-full touch-none"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                        <div className="flex gap-2">
                          <button onClick={clearCanvas} className="btn-secondary text-sm py-2 flex-1">
                            Clear
                          </button>
                          <button
                            onClick={() => handleSign(sig._id)}
                            disabled={signing}
                            className="btn-success text-sm py-2 flex-1 flex items-center justify-center gap-1"
                          >
                            {signing ? (
                              <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                            ) : '✅ Confirm'}
                          </button>
                        </div>
                        <button
                          onClick={() => setShowSignPad(null)}
                          className="w-full text-center text-dark-500 text-sm hover:text-dark-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : showReject === sig._id ? (
                      <>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection (optional)..."
                          className="input-field text-sm h-24 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowReject(null); setRejectionReason(''); }}
                            className="btn-secondary text-sm py-2 flex-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(sig._id)}
                            disabled={signing}
                            className="btn-danger text-sm py-2 flex-1 flex items-center justify-center gap-1"
                          >
                            {signing ? (
                              <div className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
                            ) : '❌ Reject'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSignPad(sig._id)}
                          className="btn-success text-sm py-2 flex-1"
                        >
                          ✍️ Sign
                        </button>
                        <button
                          onClick={() => setShowReject(sig._id)}
                          className="btn-danger text-sm py-2 flex-1"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
