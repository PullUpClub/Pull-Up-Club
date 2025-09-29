import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/LoadingState";
import { Mail, Send, CheckCircle2, AlertCircle, Calendar, TrendingUp, Award, Hash, Users, Eye } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useTranslation } from 'react-i18next';
import Head from "../../components/Layout/Head";
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const LOGO_PATH = "/PUClogo-optimized.webp";

interface MonthlyGraphicData {
  id: string;
  submission_id: string;
  user_id: string;
  month_year: string;
  previous_month_year: string | null;
  email: string;
  full_name: string;
  current_pullups: number;
  current_badge_name: string;
  current_badge_image_url: string;
  current_leaderboard_position: number;
  previous_pullups: number | null;
  previous_badge_name: string | null;
  previous_badge_image_url: string | null;
  previous_leaderboard_position: number | null;
  pullup_increase: number | null;
  position_change: number | null;
  email_sent: boolean;
  email_sent_at: string | null;
}

interface MonthOption {
  month_value: string;
  month_label: string;
  graphics_count: number;
}

const AdminMonthlyGraphicsPage: React.FC = () => {
  useTranslation('admin');
  const [graphicsData, setGraphicsData] = useState<MonthlyGraphicData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  
  // Preview state
  const [previewData, setPreviewData] = useState<MonthlyGraphicData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Fetch available months using RPC (consistent with payouts page)
  const fetchAvailableMonths = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_monthly_graphics_months');
      
      if (error) throw error;
      
      setAvailableMonths(data || []);
      
      // Set default to first month (most recent) if not already set
      if (data && data.length > 0 && !selectedMonth) {
        setSelectedMonth(data[0].month_value);
      }
    } catch (error) {
      console.error('Error fetching months:', error);
      toast.error('Failed to load available months');
    }
  };

  // Fetch graphics data for selected month
  const fetchGraphicsData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('monthly_graphics')
        .select('*')
        .eq('month_year', selectedMonth)
        .order('current_leaderboard_position', { ascending: true });

      if (error) throw error;
      setGraphicsData(data || []);
    } catch (error) {
      console.error('Error fetching graphics data:', error);
      toast.error('Failed to load monthly graphics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchGraphicsData();
    }
  }, [selectedMonth]);

  // Generate preview function
  const generatePreview = async (graphic: MonthlyGraphicData) => {
    setIsGeneratingPreview(true);
    setPreviewData(graphic);
    setShowPreviewModal(true);
    setPreviewHtml(null);
    
    try {
      // Get user earnings for the graphic
      const { data: earningsData } = await supabase
        .from('user_earnings')
        .select('total_earned_dollars')
        .eq('user_id', graphic.user_id)
        .eq('month_year', graphic.month_year)
        .single();

      // Get user profile for gender
      const { data: profileData } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', graphic.user_id)
        .single();

      const graphicData = {
        full_name: graphic.full_name,
        month_year: graphic.month_year,
        current_pullups: graphic.current_pullups,
        current_badge_name: graphic.current_badge_name,
        pullup_increase: graphic.pullup_increase,
        previous_pullups: graphic.previous_pullups,
        total_earned: earningsData?.total_earned_dollars || 0,
        gender: profileData?.gender || 'Male',
        current_leaderboard_position: graphic.current_leaderboard_position
      };

      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('generate-monthly-graphic', {
        body: { graphicData },
        headers: {
          'Authorization': `Bearer ${session.session?.access_token}`
        }
      });

      if (response.data?.success && response.data?.html) {
        setPreviewHtml(response.data.html);
        toast.success('Preview generated successfully!');
      } else {
        toast.error('Failed to generate preview');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Error generating preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Handle individual email send
  const sendIndividualEmail = async (graphic: MonthlyGraphicData) => {
    try {
      setIsSending(true);
      
      const { data, error } = await supabase.functions.invoke('send-monthly-graphics', {
        body: { 
          action: 'send-single',
          graphicIds: [graphic.id]
        }
      });

      if (error) throw error;
      
      // Show detailed success message based on response
      if (data?.sent > 0) {
        toast.success(graphic.email_sent 
          ? `Email resent immediately to ${graphic.full_name}` 
          : `Email sent immediately to ${graphic.full_name}`
        );
      } else if (data?.queued > 0) {
        toast.success(`Email queued for ${graphic.full_name} (fallback mode)`, {
          duration: 4000
        });
      } else {
        toast.success(graphic.email_sent 
          ? `Email resent to ${graphic.full_name}` 
          : `Email sent to ${graphic.full_name}`
        );
      }
      
      // Show any warnings
      if (data?.errors && data.errors.length > 0) {
        data.errors.forEach((err: string) => {
          if (err.includes('Warning:')) {
            toast.error(err, { duration: 6000 });
          }
        });
      }
      
      fetchGraphicsData(); // Refresh to show updated status
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Handle bulk email send
  const sendBulkEmails = async () => {
    const emailsToSend = selectedEmails.size > 0 
      ? Array.from(selectedEmails)
      : graphicsData.filter(g => !g.email_sent).map(g => g.id);

    if (emailsToSend.length === 0) {
      toast.error('No emails to send');
      return;
    }

    const confirmMsg = `Send ${emailsToSend.length} monthly graphic emails immediately?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      setSendingProgress({ current: 0, total: emailsToSend.length });

      const { data, error } = await supabase.functions.invoke('send-monthly-graphics', {
        body: {
          action: 'send-bulk',
          graphicIds: emailsToSend
        }
      });

      if (error) throw error;
      
      // Show detailed success message based on response
      const sentCount = data?.sent || 0;
      const queuedCount = data?.queued || 0;
      
      if (sentCount > 0) {
        toast.success(`Successfully sent ${sentCount} emails immediately${queuedCount > 0 ? ` (${queuedCount} queued as fallback)` : ''}`, {
          duration: 6000,
          style: {
            background: '#1f2937',
            color: '#ffffff',
            border: '1px solid #9b9b6f',
          },
          iconTheme: {
            primary: '#9b9b6f',
            secondary: '#ffffff',
          },
        });
      } else if (queuedCount > 0) {
        toast.success(`${queuedCount} emails queued for delivery (fallback mode)`, {
          duration: 5000,
          style: {
            background: '#1f2937',
            color: '#ffffff',
            border: '1px solid #f59e0b',
          },
          iconTheme: {
            primary: '#f59e0b',
            secondary: '#ffffff',
          },
        });
      }
      
      // Show any errors
      if (data?.errors && data.errors.length > 0) {
        const errorCount = data.errors.length;
        toast.error(`${errorCount} email${errorCount > 1 ? 's' : ''} had issues. Check console for details.`, {
          duration: 8000
        });
        console.error('Email sending errors:', data.errors);
      }
      
      setSelectedEmails(new Set());
      fetchGraphicsData();
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Failed to send bulk emails');
    } finally {
      setIsSending(false);
      setSendingProgress({ current: 0, total: 0 });
    }
  };

  // Toggle email selection
  const toggleEmailSelection = (id: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedEmails(newSelection);
  };

  // Select all unsent
  const selectAllUnsent = () => {
    const unsentIds = graphicsData
      .filter(g => !g.email_sent)
      .map(g => g.id);
    setSelectedEmails(new Set(unsentIds));
  };

  // Stats calculation
  const stats = {
    total: graphicsData.length,
    sent: graphicsData.filter(g => g.email_sent).length,
    pending: graphicsData.filter(g => !g.email_sent).length,
    improved: graphicsData.filter(g => g.pullup_increase && g.pullup_increase > 0).length
  };

  return (
    <Layout>
      <Head>
        <title>Monthly Graphics - Pull-Up Club Admin</title>
        <meta name="description" content="Send monthly performance graphics to users" />
      </Head>
      
      <div className="min-h-screen bg-black py-8 px-2 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-1 items-center justify-center">
            <img 
              src={LOGO_PATH} 
              alt="Pull-Up Club Logo" 
              className="h-12 w-auto object-contain mr-4" 
              onError={(e) => {
                console.log('Logo failed to load, trying PNG fallback');
                e.currentTarget.src = "/PUClogo.png";
              }}
            />
            <h1 className="text-2xl md:text-3xl font-bold text-[#918f6f] tracking-wide text-center">
              Admin Dashboard
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#18181b] rounded-lg border border-[#23231f] p-1">
            <Link
              to="/admin-dashboard"
              className="px-6 py-2 rounded-md text-[#9a9871] hover:text-[#ededed] transition-colors"
            >
              Submission Center
            </Link>
            <Link
              to="/admin-payouts"
              className="px-6 py-2 rounded-md text-[#9a9871] hover:text-[#ededed] transition-colors"
            >
              Monthly Payouts
            </Link>
            <span className="px-6 py-2 rounded-md bg-[#9b9b6f] text-black font-semibold">
              Monthly Graphics
            </span>
          </div>
        </div>

        {/* Monthly Graphics Section */}
        <div className="bg-[#18181b] rounded-lg border border-[#23231f] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-[#23231f]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Mail className="text-[#9b9b6f]" size={24} />
                <div>
                  <h2 className="text-xl font-semibold text-[#ededed]">Monthly Graphics Emails</h2>
                  <p className="text-[#9a9871] text-sm">
                    {stats.total} users • {stats.pending} pending • {stats.improved} improved
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Month Selector */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-[#23231f] border border-[#23231f] rounded px-3 py-2 text-[#ededed] text-sm"
                >
                  {availableMonths.length === 0 ? (
                    <option value={selectedMonth}>
                      Loading months...
                    </option>
                  ) : (
                    availableMonths.map(month => (
                      <option key={month.month_value} value={month.month_value}>
                        {month.month_label} ({month.graphics_count} users)
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="p-6 border-b border-[#23231f]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#23231f] p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="text-[#9b9b6f]" size={20} />
                  <div>
                    <p className="text-[#9a9871] text-xs">Total Users</p>
                    <p className="text-lg font-bold text-[#ededed]">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#23231f] p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-green-400" size={20} />
                  <div>
                    <p className="text-[#9a9871] text-xs">Emails Sent</p>
                    <p className="text-lg font-bold text-green-400">{stats.sent}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#23231f] p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-yellow-400" size={20} />
                  <div>
                    <p className="text-[#9a9871] text-xs">Pending</p>
                    <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#23231f] p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-[#9b9b6f]" size={20} />
                  <div>
                    <p className="text-[#9a9871] text-xs">Improved</p>
                    <p className="text-lg font-bold text-[#ededed]">{stats.improved}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <Button
                onClick={sendBulkEmails}
                disabled={isSending || stats.pending === 0}
                className="bg-[#9b9b6f] hover:bg-[#a5a575] text-black font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Immediately ({stats.pending})
              </Button>
              
              <Button
                onClick={selectAllUnsent}
                disabled={stats.pending === 0}
                variant="outline"
              >
                Select All Unsent
              </Button>

              {selectedEmails.size > 0 && (
                <Button
                  onClick={() => setSelectedEmails(new Set())}
                  variant="outline"
                >
                  Clear Selection ({selectedEmails.size})
                </Button>
              )}
            </div>

            {/* Progress indicator */}
            {isSending && sendingProgress.total > 0 && (
              <div className="mt-4 bg-[#23231f] p-3 rounded">
                <div className="flex justify-between text-sm text-[#9a9871] mb-1">
                  <span>Sending emails...</span>
                  <span>{sendingProgress.current} / {sendingProgress.total}</span>
                </div>
                <div className="w-full bg-black rounded-full h-2">
                  <div 
                    className="bg-[#9b9b6f] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Graphics Table */}
          <div className="p-6">
            {isLoading ? (
              <LoadingState message="Loading monthly graphics..." />
            ) : graphicsData.length === 0 ? (
              <div className="text-center text-[#9a9871] py-8">
                <p className="text-lg">No data for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                <p className="text-sm mt-2">Data will appear here when submissions are approved</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#23231f]">
                    <tr>
                      <th className="text-left p-3 font-medium text-[#ededed]">
                        <input
                          type="checkbox"
                          checked={selectedEmails.size === graphicsData.filter(g => !g.email_sent).length && graphicsData.filter(g => !g.email_sent).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAllUnsent();
                            } else {
                              setSelectedEmails(new Set());
                            }
                          }}
                          className="mr-2"
                          disabled={stats.pending === 0}
                        />
                        User
                      </th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Current Month</th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Progress</th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Badge</th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Rank</th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Status</th>
                      <th className="text-left p-3 font-medium text-[#ededed]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphicsData.map((graphic) => {
                      const hasImproved = graphic.pullup_increase && graphic.pullup_increase > 0;
                      const isFirstMonth = !graphic.previous_month_year;
                      
                      return (
                        <tr 
                          key={graphic.id} 
                          className={`border-b border-[#23231f] ${graphic.email_sent ? 'opacity-60' : ''}`}
                        >
                          <td className="p-3">
                            <div className="flex items-center">
                              {!graphic.email_sent && (
                                <input
                                  type="checkbox"
                                  checked={selectedEmails.has(graphic.id)}
                                  onChange={() => toggleEmailSelection(graphic.id)}
                                  className="mr-3"
                                />
                              )}
                              <div>
                                <div className="text-[#ededed] font-medium">{graphic.full_name}</div>
                                <div className="text-[#9a9871] text-xs">{graphic.email}</div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#9a9871]" />
                              <span className="text-[#ededed] font-bold">{graphic.current_pullups}</span>
                              <span className="text-[#9a9871] text-xs">pull-ups</span>
                            </div>
                          </td>
                          
                          <td className="p-3">
                            {isFirstMonth ? (
                              <span className="text-[#9a9871] text-xs">First month</span>
                            ) : hasImproved ? (
                              <div className="flex items-center gap-1 text-green-400">
                                <TrendingUp className="h-4 w-4" />
                                <span className="font-medium">+{graphic.pullup_increase}</span>
                              </div>
                            ) : (
                              <span className="text-[#9a9871]">
                                {graphic.pullup_increase === 0 ? 'No change' : `${graphic.pullup_increase}`}
                              </span>
                            )}
                          </td>
                          
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-[#9b9b6f]" />
                              <span className="text-[#ededed] text-xs">{graphic.current_badge_name}</span>
                            </div>
                          </td>
                          
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Hash className="h-3 w-3 text-[#9a9871]" />
                              <span className="text-[#ededed] font-medium">{graphic.current_leaderboard_position || 'N/A'}</span>
                              {graphic.position_change && graphic.position_change > 0 && (
                                <span className="text-green-400 text-xs ml-1">↑{graphic.position_change}</span>
                              )}
                            </div>
                          </td>
                          
                          <td className="p-3">
                            {graphic.email_sent ? (
                              <div className="text-green-400 text-xs">
                                Sent {new Date(graphic.email_sent_at!).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-yellow-400 text-xs">Pending</span>
                            )}
                          </td>
                          
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generatePreview(graphic)}
                                disabled={isGeneratingPreview}
                                className="text-xs"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => sendIndividualEmail(graphic)}
                                disabled={isSending}
                                className={`text-xs ${graphic.email_sent 
                                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                                  : 'bg-[#9b9b6f] hover:bg-[#a5a575] text-black'
                                }`}
                                title={graphic.email_sent ? 'Resend email' : 'Send email'}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                {graphic.email_sent ? 'Resend' : 'Send'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPreviewModal(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Preview: {previewData.full_name}'s Monthly Graphic
                    </h3>
                    
                    {isGeneratingPreview ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Generating preview...</span>
                      </div>
                    ) : previewHtml ? (
                      <div className="text-center">
                        <div className="inline-block border border-gray-300 rounded-lg overflow-hidden" style={{width: '600px', height: '800px'}}>
                          <iframe 
                            srcDoc={previewHtml} 
                            style={{width: '600px', height: '800px', border: 'none'}}
                            title={`${previewData.full_name}'s monthly graphic`}
                          />
                        </div>
                        <p className="text-sm text-gray-500 mt-4">
                          This is exactly how the graphic will look when sent to {previewData.full_name}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-8">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-gray-500">Failed to generate preview</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={() => {
                    if (previewHtml) {
                      sendIndividualEmail(previewData);
                      setShowPreviewModal(false);
                    }
                  }}
                  disabled={!previewHtml || isSending}
                >
                  {isSending ? 'Sending...' : 'Send This Email'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewHtml(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminMonthlyGraphicsPage;
