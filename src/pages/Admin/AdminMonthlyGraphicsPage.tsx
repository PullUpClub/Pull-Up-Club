import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/LoadingState";
import { Mail, Send, CheckCircle2, AlertCircle, Calendar, TrendingUp, Award, Hash, Users } from "lucide-react";
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

  // Handle individual email send
  const sendIndividualEmail = async (graphic: MonthlyGraphicData) => {
    try {
      setIsSending(true);
      
      const { error } = await supabase.functions.invoke('send-monthly-graphics', {
        body: { 
          action: 'send-single',
          graphicIds: [graphic.id]
        }
      });

      if (error) throw error;
      
      toast.success(`Email sent to ${graphic.full_name}`);
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

    const confirmMsg = `Send ${emailsToSend.length} monthly graphic emails?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      setSendingProgress({ current: 0, total: emailsToSend.length });

      const { error } = await supabase.functions.invoke('send-monthly-graphics', {
        body: {
          action: 'send-bulk',
          graphicIds: emailsToSend
        }
      });

      if (error) throw error;
      
      toast.success(`Successfully queued ${emailsToSend.length} emails for sending`, {
        duration: 5000,
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
                Send All Pending ({stats.pending})
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
                            {!graphic.email_sent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendIndividualEmail(graphic)}
                                disabled={isSending}
                                className="text-xs"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Send
                              </Button>
                            )}
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
    </Layout>
  );
};

export default AdminMonthlyGraphicsPage;
