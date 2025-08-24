import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingState, ErrorState } from "../../components/ui/LoadingState";
import { Eye, CheckCircle, XCircle, Star, Filter, Search, ChevronDown, Save, MessageSquare } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useTranslation } from 'react-i18next';
import Head from "../../components/Layout/Head";
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const LOGO_PATH = "/PUClogo-optimized.webp";

// Add index signature for STATUS_MAP
const STATUS_MAP: Record<string, { label: string; variant: string; icon?: string }> = {
  'pending': { label: "Pending", variant: "warning" },
  'approved': { label: "Approved", variant: "success" },
  'rejected': { label: "Rejected", variant: "danger" },
  'Pending': { label: "Pending", variant: "warning" },
  'Approved': { label: "Approved", variant: "success" },
  'Rejected': { label: "Rejected", variant: "danger" },
};

const ITEMS_PER_PAGE = 50;

const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation('admin');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [filters, setFilters] = useState({
    month: "All Months",
    status: "All Status",
    search: ""
  });

  // Fetch submissions (paginated)
  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            age,
            gender,
            organization,
            social_media,
            city,
            state
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log('Raw submissions data:', data); // Debug log
      const formattedSubmissions = (data || []).map((submission: any) => ({
        id: submission.id.toString(),
        userId: submission.user_id,
        fullName: submission.profiles?.full_name || 'Unknown User',
        email: submission.profiles?.email,
        socialHandle: submission.profiles?.social_media || '',
        challenge: 'Pull-Up Challenge',
        category: submission.region || 'General',
        submittedAt: submission.created_at,
        submissionDate: new Date(submission.created_at).toLocaleDateString(),
        status: submission.status,
        featured: submission.featured || false,
        pullUpCount: submission.pull_up_count,
        claimedCount: submission.pull_up_count,
        verifiedCount: submission.actual_pull_up_count,
        videoUrl: submission.video_url,
        notes: submission.notes,
        adminNotes: submission.admin_notes || '',
        profiles: submission.profiles
      }));
      console.log('Formatted submissions:', formattedSubmissions); // Debug log
      setSubmissions(formattedSubmissions);
      setFilteredSubmissions(formattedSubmissions);
    } catch (err) {
      console.error("Error fetching submissions:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line
  }, []);

  // Filtering logic
  useEffect(() => {
    let filtered = submissions;
    if (filters.status !== "All Status") {
      filtered = filtered.filter(sub => {
        const subStatus = sub.status.toLowerCase();
        const filterStatus = filters.status.toLowerCase();
        // Handle "Featured ⭐" filter
        if (filterStatus.includes('featured') || filterStatus.includes('⭐')) {
          return sub.featured === true;
        }
        return subStatus === filterStatus || 
               STATUS_MAP[subStatus]?.label.toLowerCase().includes(filterStatus) ||
               sub.status === filters.status;
      });
    }
    if (filters.month !== "All Months") {
      filtered = filtered.filter(sub => {
        const date = new Date(sub.submittedAt || sub.submissionDate);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        return monthYear === filters.month;
      });
    }
    if (filters.search) {
      filtered = filtered.filter(sub =>
        (sub.fullName || "").toLowerCase().includes(filters.search.toLowerCase()) ||
        (sub.socialHandle || "").toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    setFilteredSubmissions(filtered);
    setCurrentPage(1);
  }, [filters, submissions]);

  // Pagination logic
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE);

  // Save notes function
  const saveNotes = async (submissionId: string, notes: string) => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);
      
      if (error) throw error;
      
      // Update local state
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { ...sub, adminNotes: notes }
          : sub
      ));
      
      setEditingNotes(null);
      setNotesText("");
      console.log('Notes saved successfully');
      
      // Show success toast
      toast.success('Admin notes saved successfully', {
        duration: 3000,
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
    } catch (error) {
      console.error('Error saving notes:', error);
      setError(error instanceof Error ? error.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Start editing notes
  const startEditingNotes = (submissionId: string, currentNotes: string) => {
    setEditingNotes(submissionId);
    setNotesText(currentNotes);
  };

  // Cancel editing notes
  const cancelEditingNotes = () => {
    setEditingNotes(null);
    setNotesText("");
  };

  // Add sendRejectionEmail function
  const sendRejectionEmail = async (submission: any) => {
    try {
      console.log('Creating rejection email notification for submission:', submission.id);
      
      // Get the user's email from the profile if not available in submission
      let recipientEmail = submission.email;
      if (!recipientEmail && submission.profiles?.email) {
        recipientEmail = submission.profiles.email;
      }
      
      if (!recipientEmail) {
        console.error('No email found for user, cannot send rejection notification');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        console.error('Invalid email format:', recipientEmail);
        return;
      }

      // 🆕 Include admin notes directly in the email notification
      const adminNotesSection = submission.adminNotes 
        ? `
          <div style="background: linear-gradient(135deg, #2d1b0d 0%, #1a1a1a 100%); padding: 25px; border-radius: 12px; border-left: 4px solid #918f6f; margin: 25px 0; border: 1px solid #333333;">
            <h3 style="color: #918f6f; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
              📝 Feedback from our review team:
            </h3>
            <p style="color: #ffffff; font-size: 16px; margin: 0; line-height: 1.6; font-style: italic; background: rgba(145, 143, 111, 0.1); padding: 15px; border-radius: 8px;">
              "${submission.adminNotes}"
            </p>
          </div>
        ` : '';

      const emailData = {
        user_id: submission.userId,
        email_type: 'rejection',
        recipient_email: recipientEmail,
        subject: 'Your Pull-Up Club Submission Was Not Approved',
        message: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; color: #ffffff;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; padding: 30px 20px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 12px; border: 1px solid #333333;">
              <h1 style="color: #918f6f; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">Pull-Up Club</h1>
              <p style="color: #999999; margin: 8px 0 0 0; font-size: 16px;">Monthly Pull-Up Competition</p>
            </div>

            <!-- Main Content -->
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 12px; border-left: 4px solid #918f6f; margin-bottom: 30px; border: 1px solid #333333;">
              <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Submission Update</h2>
              
              <p style="color: #ffffff; font-size: 18px; margin-bottom: 20px; line-height: 1.5;">
                Hi <strong style="color: #918f6f;">${submission.fullName || 'there'}</strong>,
              </p>
              
              <p style="color: #cccccc; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                Unfortunately, your recent pull-up submission was not approved.
              </p>

              ${adminNotesSection}
              
              <p style="color: #ffffff; font-size: 16px; margin-bottom: 20px; line-height: 1.6;">
                Don't worry - you can submit a new video right away! Make sure to:
              </p>
              
              <ul style="color: #cccccc; font-size: 16px; margin: 20px 0; padding-left: 0; list-style: none;">
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #918f6f; font-weight: bold;">•</span>
                  Film in good lighting with clear form
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #918f6f; font-weight: bold;">•</span>
                  Count your reps accurately
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #918f6f; font-weight: bold;">•</span>
                  Follow our submission guidelines
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #918f6f; font-weight: bold;">•</span>
                  Ensure video quality is clear
                </li>
              </ul>
              
              <p style="color: #ffffff; font-size: 16px; margin-top: 25px; line-height: 1.6;">
                Ready to try again? Log in and submit your new video:
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://pullupclub.com/login" 
                 style="display: inline-block; 
                        background: linear-gradient(135deg, #918f6f 0%, #a19f7f 100%); 
                        color: #000000; 
                        padding: 16px 32px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(145, 143, 111, 0.3);">
                Submit New Video →
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333333; text-align: center;">
              <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
                Keep pushing your limits!
              </p>
              <p style="color: #918f6f; font-size: 16px; margin: 0 0 20px 0;">
                The Pull-Up Club Team
              </p>
              <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.4;">
                Questions? Contact us at <a href="mailto:support@pullupclub.com" style="color: #918f6f; text-decoration: none;">support@pullupclub.com</a>
              </p>
            </div>
          </div>
        `,
        // 🆕 Add admin notes as metadata so edge function can use them
        metadata: {
          admin_notes: submission.adminNotes || null,
          submission_id: submission.id
        },
        created_at: new Date().toISOString()
      };

      // Insert email notification record
      const { error: emailError } = await supabase
        .from('email_notifications')
        .insert(emailData);

      if (emailError) {
        console.error('Error creating email notification:', emailError);
        return;
      }

      console.log('Rejection email notification queued successfully for:', recipientEmail);

      // Create a second email for resubmission available notification
      const resubmissionEmailData = {
        user_id: submission.userId,
        email_type: 'resubmission',
        recipient_email: recipientEmail,
        subject: 'Your Pull-Up Club Submission - Resubmission Available',
        message: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; color: #ffffff;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; padding: 30px 20px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 12px; border: 1px solid #333333;">
              <h1 style="color: #918f6f; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">Pull-Up Club</h1>
              <p style="color: #999999; margin: 8px 0 0 0; font-size: 16px;">Monthly Pull-Up Competition</p>
            </div>

            <!-- Main Content -->
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; border-radius: 12px; border-left: 4px solid #4ade80; margin-bottom: 30px; border: 1px solid #333333;">
              <h2 style="color: #4ade80; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">🔄 Ready to Try Again?</h2>
              
              <p style="color: #ffffff; font-size: 18px; margin-bottom: 20px; line-height: 1.5;">
                Hi <strong style="color: #918f6f;">${submission.fullName || 'there'}</strong>,
              </p>
              
              <p style="color: #cccccc; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                Your submission cooldown period has ended and you can now submit a new pull-up video!
              </p>
              
              <div style="background: rgba(74, 222, 128, 0.1); border: 1px solid #4ade80; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="color: #4ade80; margin: 0; font-weight: bold; font-size: 16px;">
                  ✅ You're eligible for a new submission
                </p>
              </div>

              <p style="color: #ffffff; font-size: 16px; margin-bottom: 20px; line-height: 1.6;">
                Make your next submission count! Remember our guidelines:
              </p>
              
              <ul style="color: #cccccc; font-size: 16px; margin: 20px 0; padding-left: 0; list-style: none;">
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #4ade80; font-weight: bold;">✓</span>
                  Record in good lighting with clear visibility
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #4ade80; font-weight: bold;">✓</span>
                  Full range of motion - chin over bar, arms fully extended
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #4ade80; font-weight: bold;">✓</span>
                  Count your reps accurately and clearly
                </li>
                <li style="margin-bottom: 12px; padding-left: 25px; position: relative;">
                  <span style="position: absolute; left: 0; color: #4ade80; font-weight: bold;">✓</span>
                  Ensure video quality is clear throughout
                </li>
              </ul>
              
              <p style="color: #ffffff; font-size: 16px; margin-top: 25px; line-height: 1.6;">
                Ready to show us what you've got?
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://pullupclub.com/submit" 
                 style="display: inline-block; 
                        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); 
                        color: #000000; 
                        padding: 16px 32px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px; 
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);">
                Submit New Video →
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333333; text-align: center;">
              <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 500;">
                We believe in you!
              </p>
              <p style="color: #918f6f; font-size: 16px; margin: 0 0 20px 0;">
                The Pull-Up Club Team
              </p>
              <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.4;">
                Questions? Contact us at <a href="mailto:support@pullupclub.com" style="color: #918f6f; text-decoration: none;">support@pullupclub.com</a>
              </p>
            </div>
          </div>
        `,
        metadata: {
          submission_id: submission.id,
          email_sequence: 'resubmission_available'
        },
        created_at: new Date().toISOString()
      };

      // Insert resubmission email notification
      const { error: resubmissionEmailError } = await supabase
        .from('email_notifications')
        .insert(resubmissionEmailData);

      if (resubmissionEmailError) {
        console.error('Error creating resubmission email:', resubmissionEmailError);
      } else {
        console.log('Resubmission email notification queued successfully for:', recipientEmail);
      }
      
      // SECURE: Get current session and pass authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Authentication required for email function:', sessionError);
        return;
      }

      // Trigger the edge function with proper authentication
      const { error: functionError } = await supabase.functions.invoke('send-rejection-email', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (functionError) {
        console.error('Error triggering email function:', functionError);
      } else {
        console.log('Email function triggered successfully - admin notes included via metadata');
      }

    } catch (err) {
      console.error('Failed to queue rejection email:', err);
    }
  };

  // Update handleStatusChange to handle featured separately
  const handleStatusChange = async (
    submissionId: string,
    newStatus: 'Approved' | 'Rejected',
    verifiedCount?: number
  ) => {
    setIsLoading(true);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      let updateObj: any = {
        updated_at: new Date().toISOString()
      };
      
      // Handle different status updates
      if (newStatus === 'Approved') {
        updateObj.status = 'approved';
        updateObj.actual_pull_up_count = verifiedCount;
      } else if (newStatus === 'Rejected') {
        updateObj.status = 'rejected';
      }
      
      console.log('Updating submission with:', updateObj); // Debug log
      const { error } = await supabase
        .from('submissions')
        .update(updateObj)
        .eq('id', submissionId);
      
      if (error) {
        console.error('Database update error:', error);
        throw error;
      }
      
      // Process earnings for approved submissions
      if (newStatus === 'Approved' && submission && verifiedCount) {
        try {
          console.log('Processing earnings for approved submission:', submissionId);
          const { data: earningsResult, error: earningsError } = await supabase.rpc('process_submission_earnings', {
            p_submission_id: submissionId,
            p_user_id: submission.userId,
            p_pull_up_count: verifiedCount
          });
          
          if (earningsError) {
            console.error('Error processing earnings:', earningsError);
            // Don't fail the approval if earnings processing fails
          } else if (earningsResult?.success) {
            console.log('Earnings processed successfully:', earningsResult);
          }
        } catch (earningsErr) {
          console.error('Error processing earnings:', earningsErr);
          // Don't fail the approval if earnings processing fails
        }
      }
      
      // Send rejection email if status is rejected
      if (newStatus === 'Rejected' && submission) {
        await sendRejectionEmail(submission);
      }
      
      await fetchSubmissions();
      console.log(`Submission ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      console.error('Error updating submission:', error);
      setError(error instanceof Error ? error.message : 'Failed to update submission');
    } finally {
      setIsLoading(false);
    }
  };

  // Add toggleFeatured function
  const toggleFeatured = async (submissionId: string) => {
    setIsLoading(true);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) throw new Error('Submission not found');

      const updateObj = {
        featured: !submission.featured,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('submissions')
        .update(updateObj)
        .eq('id', submissionId);

      if (error) throw error;
      await fetchSubmissions();
      console.log(`Submission featured status toggled successfully`);
    } catch (error) {
      console.error('Error toggling featured status:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle featured status');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for status badge
  const getStatusBadge = (status: string, featured: boolean) => {
    const statusKey = status.toLowerCase();
    const map = STATUS_MAP[statusKey] || STATUS_MAP[status] || { label: status, variant: 'default' };
    
    return (
      <div className="flex items-center gap-2">
        <Badge variant={map.variant as any}>{map.label}</Badge>
        {featured && (
          <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-300">
            <Star className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        )}
      </div>
    );
  };

  // Unique filter options
  const months = [
    "All Months",
    ...Array.from(new Set(submissions.map(sub => {
      const date = new Date(sub.submittedAt || sub.submissionDate);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    }))).filter(Boolean)
  ];
  const statuses = [
    "All Status",
    "Pending",
    "Approved", 
    "Rejected",
    "Featured ⭐"
  ];

  // Count of new submissions
  const newSubmissionsCount = submissions.filter(sub => sub.status === 'Pending').length;

  return (
    <Layout>
      <Head>
        <title>{t("meta.title")}</title>
        <meta name="description" content={t("meta.description")} />
      </Head>
      <div className="min-h-screen bg-black py-8 px-2 md:px-8">
        {/* Email notification banner */}
        <div className="bg-[#918f6f]/10 border border-[#918f6f] text-white p-4 rounded-lg mb-6">
          <p className="text-sm">
            📧 <strong className="text-[#918f6f]">{t('submissions.emailBanner.title')}</strong> {t('submissions.emailBanner.text')}
            <br />
            <span className="text-[#918f6f]/80">{t('submissions.emailBanner.warning')}</span>
          </p>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-1 items-center justify-center">
            <img 
              src={LOGO_PATH} 
              alt={t('common:misc.logoAlt')} 
              className="h-12 w-auto object-contain mr-4" 
              onError={(e) => {
                console.log('Logo failed to load, trying PNG fallback');
                e.currentTarget.src = "/PUClogo.png";
              }}
            />
            <h1 className="text-2xl md:text-3xl font-bold text-[#918f6f] tracking-wide text-center">
              {t('title')}
            </h1>
          </div>
          {newSubmissionsCount > 0 && (
            <div className="flex items-center bg-[#9a9871]/10 border border-[#9a9871] rounded-lg px-4 py-2">
              <span className="w-6 h-6 bg-[#9a9871] text-black font-bold rounded-full flex items-center justify-center mr-2">{newSubmissionsCount}</span>
              <span className="text-[#9a9871] text-sm font-medium">{t('submissions.newSubmissions')}</span>
            </div>
          )}
        </div>

        {/* Toggle Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#18181b] rounded-lg border border-[#23231f] p-1">
            <span className="px-6 py-2 rounded-md bg-[#9b9b6f] text-black font-semibold">
              Submission Center
            </span>
            <Link
              to="/admin-payouts"
              className="px-6 py-2 rounded-md text-[#9a9871] hover:text-[#ededed] transition-colors"
            >
              Monthly Payouts
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#18181b] rounded-lg shadow-sm border border-[#23231f] p-4 mb-6">
          <div className="flex items-center mb-2 justify-between">
            <div className="flex items-center">
            <Filter className="h-5 w-5 text-[#9a9871] mr-2" />
            <span className="font-medium text-[#ededed]">{t('submissions.filterTitle')}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilters({ month: t('submissions.allMonths'), status: t('submissions.allStatuses'), search: "" })}>
              {t('submissions.resetFilters')}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Month Filter */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-1">{t('submissions.filterMonth')}</label>
              <select 
                className="w-full p-2 border border-[#23231f] rounded-md bg-black text-[#ededed] text-sm" 
                value={filters.month} 
                onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              >
                {months.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-1">{t('submissions.filterStatus')}</label>
              <select 
                className="w-full p-2 border border-[#23231f] rounded-md bg-black text-[#ededed] text-sm" 
                value={filters.status} 
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              >
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Search Filter */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-1">{t('submissions.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#918f6f]" />
                <input 
                  type="text" 
                  placeholder={t('submissions.searchPlaceholder')} 
                  className="w-full pl-10 pr-4 py-2 border border-[#23231f] rounded-md bg-black text-[#ededed] text-sm" 
                  value={filters.search} 
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#18181b] rounded-lg shadow-sm border border-[#23231f] overflow-hidden">
          {isLoading ? (
            <LoadingState message={t('submissions.loading')} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#23231f] border-b border-[#23231f]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#ededed] uppercase tracking-wider">{t('submissions.table.user')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#ededed] uppercase tracking-wider">{t('submissions.table.date')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#ededed] uppercase tracking-wider">{t('submissions.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#ededed] uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#ededed] uppercase tracking-wider">{t('submissions.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-black divide-y divide-[#23231f]">
                  {paginatedSubmissions.map((submission) => (
                    <React.Fragment key={submission.id}>
                      <tr className="hover:bg-[#23231f] cursor-pointer" onClick={() => setSelectedSubmission(selectedSubmission?.id === submission.id ? null : submission)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-[#ededed]">{submission.fullName}</div>
                            <div className="text-xs text-[#9a9871]">{submission.socialHandle}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#ededed]">
                          {new Date(submission.submittedAt || submission.submissionDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(submission.status, submission.featured)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#ededed]">
                          {submission.adminNotes ? (
                            <div className="flex items-center">
                              <MessageSquare className="h-4 w-4 text-[#9a9871] mr-1" />
                              <span className="text-xs text-[#9a9871] truncate max-w-[100px]">
                                {submission.adminNotes.substring(0, 20)}{submission.adminNotes.length > 20 ? '...' : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">No notes</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); window.open(submission.videoUrl, '_blank'); }}>
                            <Eye className="h-4 w-4 mr-1" />
                            {t('submissions.actions.viewVideo')}
                          </Button>
                          <Button variant="secondary" size="sm" className="ml-2" onClick={e => { e.stopPropagation(); setSelectedSubmission(selectedSubmission?.id === submission.id ? null : submission); }}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                      {/* Expandable details section with notes */}
                      {selectedSubmission?.id === submission.id && (
                        <tr>
                          <td colSpan={5} className="px-6 py-3 bg-[#1a1a17]">
                            <div className="max-w-4xl w-full">
                              {/* Compact submission info */}
                              <div className="mb-3">
                                <h5 className="font-medium text-[#ededed] mb-2 text-sm">{t('submissions.actions.infoTitle')}</h5>
                                <div className="bg-[#23231f] p-3 rounded text-sm">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#9a9871]">{t('submissions.actions.claimed')}</span>
                                    <span className="text-[#ededed] font-bold">{submission.pullUpCount}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[#9a9871]">{t('submissions.actions.verified')}</span>
                                    <span className={`font-bold ${submission.verifiedCount ? 'text-green-400' : 'text-yellow-400'}`}>{submission.verifiedCount || t('submissions.actions.pending')}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Notes Section */}
                              <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-[#ededed] text-sm flex items-center">
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Admin Notes
                                  </h5>
                                  {editingNotes !== submission.id && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => startEditingNotes(submission.id, submission.adminNotes)}
                                      className="text-xs"
                                    >
                                      {submission.adminNotes ? 'Edit Notes' : 'Add Notes'}
                                    </Button>
                                  )}
                                </div>
                                
                                {editingNotes === submission.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={notesText}
                                      onChange={(e) => setNotesText(e.target.value)}
                                      placeholder="Add notes about this submission (visible to other admins and included in rejection emails)..."
                                      className="w-full p-3 border border-[#23231f] rounded bg-black text-[#ededed] text-sm min-h-[80px] resize-vertical"
                                      rows={3}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => saveNotes(submission.id, notesText)}
                                        disabled={savingNotes}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                      >
                                        {savingNotes ? (
                                          <>Saving...</>
                                        ) : (
                                          <>
                                            <Save className="h-3 w-3 mr-1" />
                                            Save Notes
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelEditingNotes}
                                        disabled={savingNotes}
                                        className="text-xs px-3 py-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-[#23231f] p-3 rounded text-sm">
                                    {submission.adminNotes ? (
                                      <p className="text-[#ededed] whitespace-pre-wrap">{submission.adminNotes}</p>
                                    ) : (
                                      <p className="text-gray-500 italic">No notes added yet</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Compact actions */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="number"
                                  placeholder={t('submissions.actions.countPlaceholder')}
                                  className="w-20 px-2 py-1 border border-[#23231f] rounded text-sm bg-black text-[#ededed]"
                                  id={`verify-${submission.id}`}
                                  defaultValue={submission.verifiedCount || submission.pullUpCount}
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    const input = document.getElementById(`verify-${submission.id}`) as HTMLInputElement;
                                    const verifiedCount = parseInt(input.value) || submission.pullUpCount;
                                    handleStatusChange(submission.id, 'Approved', verifiedCount);
                                  }}
                                  disabled={isLoading}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {t('submissions.actions.approve')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => toggleFeatured(submission.id)}
                                  disabled={isLoading}
                                  className={`${submission.featured ? 'bg-amber-700' : 'bg-amber-600'} hover:bg-amber-700 text-white text-xs px-3 py-1`}
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  {submission.featured ? t('submissions.actions.unfeature') : t('submissions.actions.feature')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleStatusChange(submission.id, 'Rejected')}
                                  disabled={isLoading}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {t('submissions.actions.reject')}
                                </Button>
                                <button
                                  onClick={() => window.open(submission.videoUrl, '_blank')}
                                  className="bg-[#9a9871] hover:bg-[#a5a575] text-black px-3 py-1 rounded text-xs font-semibold"
                                >
                                  {t('submissions.actions.watchVideo')}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-[#ededed]">
            {t('submissions.pagination.showing', { count: paginatedSubmissions.length, total: filteredSubmissions.length })}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('submissions.pagination.previous')}</Button>
            <span className="text-[#ededed] text-sm">{t('submissions.pagination.page', { current: currentPage, total: totalPages })}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('submissions.pagination.next')}</Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboardPage;