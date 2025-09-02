import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Types
interface AgentReport {
  _id: string;
  researchId?: string;
  query: string;
  executiveSummary?: string;
  result?: {
    executiveSummary?: string;
    technicalDiagnosis?: {
      primaryIssue: string;
      dtcCodes: string[];
    };
    partsAnalysis?: {
      totalPartsEstimate: string;
    };
    laborAnalysis?: {
      totalLaborEstimate: string;
    };
  };
  metadata?: {
    agentType?: string;
    processingTime?: number;
    searchCount?: number;
  };
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    vin?: string;
  };
  status: 'pending' | 'completed' | 'failed';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ReportsResponse {
  success: boolean;
  data: AgentReport[];
  pagination: PaginationInfo;
}

interface StatsResponse {
  success: boolean;
  data: {
    totalReports: number;
    reportsByStatus: {
      pending: number;
      completed: number;
      failed: number;
    };
    reportsByMonth: Array<{
      month: string;
      count: number;
    }>;
    topSearchQueries: Array<{
      query: string;
      count: number;
    }>;
  };
}

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/agent-reports';

const Reports: React.FC = () => {
  // State
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<AgentReport | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch reports
  const fetchReports = async (page: number = 1, search: string = '', status: string = '') => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}?page=${page}&limit=${pagination.limit}`;
      
      if (search.trim()) {
        url = `${API_BASE_URL}/search?q=${encodeURIComponent(search)}&limit=${pagination.limit}`;
      } else if (status) {
        url = `${API_BASE_URL}/by-status/${status}?page=${page}&limit=${pagination.limit}`;
      }
      
      const response = await axios.get<ReportsResponse>(url);
      
      if (response.data.success) {
        setReports(response.data.data);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setError('Failed to fetch reports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get<StatsResponse>(`${API_BASE_URL}/stats`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchReports(1, searchQuery, statusFilter);
  };

  // Status filter handler
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchReports(1, searchQuery, status);
  };

  // Pagination handler
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchReports(newPage, searchQuery, statusFilter);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // View report details
  const viewReportDetails = (report: AgentReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Reports</h1>
        <p className="text-gray-600">View and manage automotive diagnostic reports generated by AI agents</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Reports</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{stats.reportsByStatus.completed}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.reportsByStatus.pending}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Failed</h3>
            <p className="text-2xl font-bold text-red-600">{stats.reportsByStatus.failed}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search reports by query or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('');
              fetchReports(1);
            }}
            className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </form>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => handleStatusFilter('')}
            className={`px-3 py-1 rounded-full text-sm ${!statusFilter ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            All
          </button>
          <button
            onClick={() => handleStatusFilter('completed')}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Completed
          </button>
          <button
            onClick={() => handleStatusFilter('pending')}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Pending
          </button>
          <button
            onClick={() => handleStatusFilter('failed')}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === 'failed' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-500">
              {searchQuery || statusFilter ? 'Try adjusting your search or filters' : 'No agent reports have been generated yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Query
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {report.query}
                        </div>
                        {(report.result?.executiveSummary || report.executiveSummary) && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {report.result?.executiveSummary || report.executiveSummary}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {report.vehicle ? (
                            `${report.vehicle.year || ''} ${report.vehicle.make || ''} ${report.vehicle.model || ''}`.trim()
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <button
                          onClick={() => viewReportDetails(report)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                    disabled={pagination.page >= pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                        disabled={pagination.page <= 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        const pageNum = Math.max(1, pagination.page - 2) + i;
                        if (pageNum > pagination.pages) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pageNum === pagination.page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                        disabled={pagination.page >= pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for Report Details */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">Report Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700">Query:</h4>
                  <p className="text-gray-600">{selectedReport.query}</p>
                </div>
                
                {(selectedReport.result?.executiveSummary || selectedReport.executiveSummary) && (
                  <div>
                    <h4 className="font-semibold text-gray-700">Executive Summary:</h4>
                    <p className="text-gray-600">
                      {selectedReport.result?.executiveSummary || selectedReport.executiveSummary}
                    </p>
                  </div>
                )}
                
                {selectedReport.result?.technicalDiagnosis && (
                  <div>
                    <h4 className="font-semibold text-gray-700">Technical Diagnosis:</h4>
                    <p className="text-gray-600 mb-2">
                      <strong>Primary Issue:</strong> {selectedReport.result.technicalDiagnosis.primaryIssue}
                    </p>
                    {selectedReport.result.technicalDiagnosis.dtcCodes && selectedReport.result.technicalDiagnosis.dtcCodes.length > 0 && (
                      <p className="text-gray-600">
                        <strong>DTC Codes:</strong> {selectedReport.result.technicalDiagnosis.dtcCodes.join(', ')}
                      </p>
                    )}
                  </div>
                )}
                
                {selectedReport.result?.partsAnalysis && (
                  <div>
                    <h4 className="font-semibold text-gray-700">Parts Analysis:</h4>
                    <p className="text-gray-600">
                      <strong>Total Parts Estimate:</strong> {selectedReport.result.partsAnalysis.totalPartsEstimate}
                    </p>
                  </div>
                )}
                
                {selectedReport.result?.laborAnalysis && (
                  <div>
                    <h4 className="font-semibold text-gray-700">Labor Analysis:</h4>
                    <p className="text-gray-600">
                      <strong>Total Labor Estimate:</strong> {selectedReport.result.laborAnalysis.totalLaborEstimate}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="font-semibold text-gray-700">Status:</h4>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedReport.status)}`}>
                      {selectedReport.status}
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-700">Created:</h4>
                    <p className="text-gray-600">{formatDate(selectedReport.createdAt)}</p>
                  </div>
                </div>
                
                {selectedReport.tags && selectedReport.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700">Tags:</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedReport.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;