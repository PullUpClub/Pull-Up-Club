import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface GraphicData {
  full_name: string;
  month_year: string;
  current_pullups: number;
  current_badge_name: string;
  pullup_increase: number | null;
  previous_pullups: number | null;
  total_earned?: number;
  gender?: string;
  current_leaderboard_position?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { graphicData } = await req.json() as { graphicData: GraphicData };
    
    console.log(`🎨 Starting graphic generation for ${graphicData.full_name} (${graphicData.month_year})`);
    
    // Generate HTML template
    const html = generateProfessionalGraphic(graphicData);
    
    // Try to convert HTML to PNG using htmlcsstoimage.com API
    const API_KEY = Deno.env.get('HTMLCSSTOIMAGE_API_KEY');
    const API_ID = Deno.env.get('HTMLCSSTOIMAGE_API_ID');
    
    console.log('🔑 Credentials check:', {
      hasApiKey: !!API_KEY,
      hasApiId: !!API_ID,
      apiIdLength: API_ID?.length || 0,
      apiKeyLength: API_KEY?.length || 0
    });
    
    if (!API_KEY || !API_ID) {
      console.error('❌ Missing HTMLCSSTOIMAGE credentials');
      return new Response(
        JSON.stringify({ 
          success: true, 
          html: html,
          imageUrl: '',
          message: 'Missing HTMLCSSTOIMAGE_API_KEY or HTMLCSSTOIMAGE_API_ID'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    try {
      const API_URL = 'https://hcti.io/v1/image';
      
      // Create Base64 encoded auth string - simplified per HTMLCSSTOIMAGE docs
      const authString = `${API_ID}:${API_KEY}`;
      const base64 = btoa(authString);
      
      console.log('📤 Sending request to HTMLCSSTOIMAGE...');
      console.log(`   URL: ${API_URL}`);
      console.log(`   API_ID: ${API_ID}`);
      console.log(`   Auth (first 20 chars): Basic ${base64.substring(0, 20)}...`);
      
      const requestBody = {
        html: html,
        selector: '.graphic-container',
        device_scale: 2,
        format: 'png'
      };
      
      console.log('   Request body keys:', Object.keys(requestBody));
      console.log(`   HTML length: ${html.length} characters`);
      
      // Add AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏱️  TIMEOUT: HTMLCSSTOIMAGE API took longer than 30 seconds');
        controller.abort();
      }, 30000); // 30 second timeout (increased from 20)
      
      const startTime = Date.now();
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      console.log(`⏱️  API response received in ${duration}ms`);
      console.log(`📡 HTTP Status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log(`📦 Response body length: ${responseText.length} bytes`);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        console.error('   Raw response:', responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from HTMLCSSTOIMAGE API`);
      }
      
      console.log('📊 Parsed API response:', {
        success: response.ok,
        hasUrl: !!result.url,
        hasId: !!result.id,
        hasError: !!result.error,
        url: result.url ? `${result.url.substring(0, 50)}...` : null,
        errorMessage: result.error || result.message
      });
      
      if (response.ok && result.url) {
        console.log('✅ SUCCESS! Image generated successfully');
        console.log(`   Image URL: ${result.url}`);
        console.log(`   Image ID: ${result.id || 'N/A'}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            imageUrl: result.url,
            imageId: result.id,
            html: html
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('❌ HTMLCSSTOIMAGE API failed');
        console.error(`   Status: ${response.status}`);
        console.error(`   Full response:`, result);
        
        // Return empty imageUrl on failure
        return new Response(
          JSON.stringify({ 
            success: true, 
            html: html,
            imageUrl: '',
            message: `HTMLCSSTOIMAGE API failed: ${result.error || result.message || 'Unknown error'}`,
            apiError: result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (imageError) {
      console.error('❌ Exception during image generation:', imageError);
      console.error('   Error name:', imageError.name);
      console.error('   Error message:', imageError.message);
      
      if (imageError.name === 'AbortError') {
        console.error('   Cause: API request timed out');
      }
      
      // Return empty imageUrl on exception
      return new Response(
        JSON.stringify({ 
          success: true, 
          html: html,
          imageUrl: '',
          message: `Exception: ${imageError.message}`,
          errorType: imageError.name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Fatal error in generate-monthly-graphic:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateProfessionalGraphic(data: GraphicData): string {
  const hasImprovement = data.pullup_increase && data.pullup_increase > 0;
  const isFirstMonth = !data.previous_pullups;
  const monthName = formatMonth(data.month_year);
  
  // Calculate correct badge based on pull-ups (double-check accuracy)
  const correctBadge = calculateCorrectBadge(data.current_pullups, data.gender || 'Male');
  const badgeImageUrl = getBadgeImageUrl(correctBadge, data.gender || 'Male');
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const pucLogoUrl = `${SUPABASE_URL}/storage/v1/object/public/graphics-assets/logos/puc-logo.webp`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700;800&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Rajdhani', sans-serif;
                background: #000000;
                width: 600px;
                height: 800px;
                overflow: hidden;
                position: relative;
            }

            .graphic-container {
                width: 100%;
                height: 100%;
                position: relative;
                background: 
                    radial-gradient(ellipse at top, rgba(145, 143, 111, 0.15) 0%, transparent 50%),
                    linear-gradient(135deg, #000000 0%, #0f0f0f 25%, #1a1a1a 50%, #111111 75%, #000000 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 25px 40px;
                color: #ffffff;
                border: 1px solid rgba(145, 143, 111, 0.2);
            }

            /* Professional military texture overlay */
            .graphic-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    radial-gradient(circle at 30% 30%, rgba(145, 143, 111, 0.08) 0%, transparent 40%),
                    radial-gradient(circle at 70% 70%, rgba(145, 143, 111, 0.06) 0%, transparent 40%),
                    linear-gradient(45deg, transparent 49%, rgba(255, 255, 255, 0.005) 50%, transparent 51%);
                z-index: 1;
            }

            .content-wrapper {
                position: relative;
                z-index: 2;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            /* Header */
            .header {
                text-align: center;
                margin-bottom: 25px;
            }

            .site-title {
                font-family: 'Orbitron', monospace;
                font-size: 32px;
                font-weight: 900;
                color: #ffffff;
                letter-spacing: 3px;
                margin-bottom: 8px;
                text-shadow: 
                    0 0 5px rgba(255, 255, 255, 0.3),
                    0 0 10px rgba(255, 255, 255, 0.2);
            }

            .subtitle {
                font-size: 18px;
                font-weight: 700;
                color: #918f6f;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            /* Logo Section */
            .logo-section {
                margin-bottom: 25px;
                position: relative;
            }

            .puc-logo {
                width: 120px;
                height: 120px;
                filter: drop-shadow(0 8px 25px rgba(0, 0, 0, 0.7));
                object-fit: contain;
            }

            /* Month Display */
            .month-display {
                font-family: 'Orbitron', monospace;
                font-size: 36px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 25px;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
                letter-spacing: 3px;
                text-align: center;
            }

            /* Main Content Area */
            .main-content {
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid rgba(145, 143, 111, 0.3);
                border-radius: 15px;
                padding: 25px;
                width: 100%;
                max-width: 480px;
                margin-bottom: 25px;
                backdrop-filter: blur(5px);
            }

            .user-name {
                font-size: 32px;
                font-weight: 800;
                color: #ffffff;
                margin-bottom: 25px;
                text-align: center;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            /* Stats Boxes */
            .stats-container {
                display: flex;
                gap: 15px;
                margin-bottom: 25px;
                justify-content: center;
            }

            .stat-box {
                width: 180px;
                height: 75px;
                background: 
                    linear-gradient(135deg, #918f6f 0%, #a19f7f 50%, #b5b395 100%);
                border-radius: 25px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #000000;
                position: relative;
                box-shadow: 
                    0 6px 20px rgba(145, 143, 111, 0.5),
                    0 2px 8px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .stat-icon {
                font-size: 14px;
                margin-bottom: 3px;
            }

            .stat-label {
                font-size: 11px;
                font-weight: 700;
                margin-bottom: 2px;
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            .stat-value {
                font-size: 20px;
                font-weight: 800;
                line-height: 1;
            }

            /* Progress Section */
            .progress-section {
                margin-bottom: 30px;
                text-align: center;
            }

            .pullup-increase {
                font-size: 32px;
                font-weight: 800;
                color: #00ff88;
                text-shadow: 
                    0 0 10px rgba(0, 255, 136, 0.6),
                    0 0 20px rgba(0, 255, 136, 0.3);
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            .first-month-badge {
                font-size: 28px;
                font-weight: 800;
                color: #ffd700;
                text-shadow: 
                    0 0 10px rgba(255, 215, 0, 0.6),
                    0 0 20px rgba(255, 215, 0, 0.3);
                letter-spacing: 1px;
            }

            .keep-pushing {
                font-size: 24px;
                font-weight: 700;
                color: #918f6f;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            /* Badge Section - Exact match to leaderboard styling */
            .badge-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-top: auto;
                padding-bottom: 20px;
            }

            .badge-container {
                position: relative;
                margin-bottom: 15px;
            }

            .badge-circle {
                width: 128px;
                height: 128px;
                border-radius: 50%;
                border: 4px solid #9b9b6f;
                box-shadow: 
                    0 0 30px rgba(155, 155, 111, 0.4),
                    0 8px 25px rgba(0, 0, 0, 0.6);
                overflow: hidden;
                background: rgba(17, 24, 39, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .badge-image {
                width: 90%;
                height: 90%;
                object-fit: contain;
                padding: 4px;
                transform: scale(1.25);
            }

            .badge-label {
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                background: #9b9b6f;
                color: #000000;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 800;
                font-family: 'Orbitron', monospace;
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            .badge-name {
                font-size: 28px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: 3px;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
                text-transform: uppercase;
                margin-top: 10px;
            }

            /* Military corner decorations */
            .corner-decoration {
                position: absolute;
                width: 50px;
                height: 50px;
                border: 3px solid rgba(145, 143, 111, 0.6);
            }

            .corner-decoration.top-left {
                top: 20px;
                left: 20px;
                border-right: none;
                border-bottom: none;
                border-top-left-radius: 2px;
            }

            .corner-decoration.top-right {
                top: 20px;
                right: 20px;
                border-left: none;
                border-bottom: none;
                border-top-right-radius: 2px;
            }

            .corner-decoration.bottom-left {
                bottom: 20px;
                left: 20px;
                border-right: none;
                border-top: none;
                border-bottom-left-radius: 2px;
            }

            .corner-decoration.bottom-right {
                bottom: 20px;
                right: 20px;
                border-left: none;
                border-top: none;
                border-bottom-right-radius: 2px;
            }
        </style>
    </head>
    <body>
        <div class="graphic-container">
            <!-- Decorative corners -->
            <div class="corner-decoration top-left"></div>
            <div class="corner-decoration top-right"></div>
            <div class="corner-decoration bottom-left"></div>
            <div class="corner-decoration bottom-right"></div>
            
            <div class="content-wrapper">
                <!-- Header -->
                <div class="header">
                    <h1 class="site-title">PULLUPCLUB.COM</h1>
                    <h2 class="subtitle">MONTH IN REVIEW</h2>
                </div>

                <!-- Logo -->
                <div class="logo-section">
                    <img src="${pucLogoUrl}" alt="Pull-Up Club Logo" class="puc-logo" />
                </div>

                <!-- Month Display -->
                <div class="month-display">
                    ${monthName.toUpperCase()}
                </div>

                <!-- Main Content -->
                <div class="main-content">
                    <!-- User Name -->
                    <div class="user-name">
                        ${data.full_name.toUpperCase()}
                    </div>

                    <!-- Stats Boxes -->
                    <div class="stats-container">
                        <div class="stat-box">
                            <div class="stat-icon">🏦</div>
                            <div class="stat-label">EARNINGS</div>
                            <div class="stat-value">$${data.total_earned || 0}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-icon">💪</div>
                            <div class="stat-label">VERIFIED PULLUPS</div>
                            <div class="stat-value">${data.current_pullups}</div>
                        </div>
                    </div>

                    <!-- Progress Indicator -->
                    <div class="progress-section">
                        ${isFirstMonth 
                          ? '<div class="first-month-badge">FIRST MONTH</div>'
                          : hasImprovement 
                          ? `<div class="pullup-increase">+${data.pullup_increase} PULLUP INCREASE</div>`
                          : '<div class="keep-pushing">KEEP PUSHING!</div>'
                        }
                    </div>
                </div>

                <!-- Badge Section -->
                <div class="badge-section">
                    <div class="badge-container">
                        <div class="badge-circle">
                            <img src="${badgeImageUrl}" alt="${data.current_badge_name} Badge" class="badge-image" />
                        </div>
                        <div class="badge-label">${correctBadge.toUpperCase()}</div>
                    </div>
                    <div class="badge-name">${correctBadge.toUpperCase()}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

function getBadgeImageUrl(badgeName: string, gender: string): string {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/graphics-assets`;
  
  if (gender?.toLowerCase() === 'female') {
    // Female badges have mixed extensions - use exact mapping from storage
    const femaleMapping: { [key: string]: string } = {
      'elite': 'elite.webp',
      'hardened': 'hardened.png',  // Different extension!
      'operator': 'operator.webp',
      'proven': 'proven.webp',
      'recruit': 'recruit.webp'
    };
    
    const filename = femaleMapping[badgeName.toLowerCase()] || 'recruit.webp';
    return `${baseUrl}/badges/female/${filename}`;
  } else {
    // Male badges are all .png
    return `${baseUrl}/badges/male/${badgeName.toLowerCase()}.png`;
  }
}

function calculateCorrectBadge(pullUps: number, gender: string): string {
  if (gender?.toLowerCase() === 'female') {
    // Female badge thresholds
    if (pullUps >= 20) return 'Elite';
    if (pullUps >= 15) return 'Operator';
    if (pullUps >= 12) return 'Hardened';
    if (pullUps >= 7) return 'Proven';
    return 'Recruit'; // 3+ pull-ups
  } else {
    // Male badge thresholds
    if (pullUps >= 25) return 'Elite';
    if (pullUps >= 20) return 'Operator';
    if (pullUps >= 15) return 'Hardened';
    if (pullUps >= 10) return 'Proven';
    return 'Recruit'; // 5+ pull-ups
  }
}

function formatMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
