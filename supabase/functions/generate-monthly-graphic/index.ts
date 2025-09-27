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
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { graphicData } = requestBody as { graphicData: GraphicData };
    
    if (!graphicData) {
      throw new Error('Missing graphicData in request body');
    }
    
    console.log('Processing graphic for:', graphicData.full_name);
    
    // Generate high-quality graphic using HTML/CSS to Image
    const imageUrl = await generateHighQualityGraphic(graphicData);
    console.log('Image URL generated:', imageUrl);
    
    // Generate HTML for preview
    const html = generateProfessionalGraphic(graphicData);
    console.log('HTML generated, length:', html.length);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageUrl,
        html: html // Return HTML for preview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating graphic:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHighQualityGraphic(data: GraphicData): Promise<string> {
  const HTMLCSSTOIMAGE_KEY = Deno.env.get('HTMLCSSTOIMAGE_API_KEY');
  
  if (!HTMLCSSTOIMAGE_KEY) {
    // For development, return a placeholder URL since we're returning HTML separately
    return 'data:text/html,<h1>Preview Generated</h1>';
  }
  
  const html = generateProfessionalGraphic(data);
  
  const response = await fetch('https://hcti.io/v1/image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(`${HTMLCSSTOIMAGE_KEY}:`)}`,
    },
    body: JSON.stringify({
      html: html,
      width: 1200,
      height: 1600,
      device_scale: 2, // High DPI for crisp quality
      format: 'png',
      quality: 95,
      ms_delay: 1000 // Wait for fonts and images to load
    })
  });

  const result = await response.json();
  
  if (!result.url) {
    throw new Error('Failed to generate image: ' + (result.error || 'Unknown error'));
  }
  
  return result.url;
}

function generateProfessionalGraphic(data: GraphicData): string {
  const hasImprovement = data.pullup_increase && data.pullup_increase > 0;
  const isFirstMonth = !data.previous_pullups;
  const monthName = formatMonth(data.month_year);
  const badgeImageUrl = getSupabaseBadgeImageUrl(data.current_badge_name, data.gender || 'Male');
  const logoUrl = getSupabaseLogoUrl();
  
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
                /* Force high quality rendering */
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
            }

            .graphic-container {
                width: 100%;
                height: 100%;
                position: relative;
                background: 
                    linear-gradient(180deg, #000000 0%, #1a1a1a 30%, #2a2a2a 60%, #1a1a1a 90%, #000000 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 30px 40px;
                color: #ffffff;
            }

            /* Military texture overlay */
            .graphic-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    radial-gradient(ellipse at 20% 20%, rgba(145, 143, 111, 0.08) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 80%, rgba(145, 143, 111, 0.08) 0%, transparent 60%),
                    linear-gradient(45deg, transparent 48%, rgba(145, 143, 111, 0.02) 49%, rgba(145, 143, 111, 0.03) 50%, rgba(145, 143, 111, 0.02) 51%, transparent 52%),
                    repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(145, 143, 111, 0.01) 2px,
                        rgba(145, 143, 111, 0.01) 4px
                    );
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

            /* Header - Matching your examples exactly */
            .header {
                text-align: center;
                margin-bottom: 25px;
            }

            .site-title {
                font-family: 'Orbitron', monospace;
                font-size: 36px;
                font-weight: 900;
                color: #ffffff;
                letter-spacing: 4px;
                margin-bottom: 8px;
                text-shadow: 
                    0 0 10px rgba(255, 255, 255, 0.4),
                    0 0 20px rgba(255, 255, 255, 0.2),
                    0 3px 8px rgba(0, 0, 0, 0.9),
                    0 1px 3px rgba(145, 143, 111, 0.3);
                background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .subtitle {
                font-size: 20px;
                font-weight: 800;
                color: #918f6f;
                letter-spacing: 3px;
                text-transform: uppercase;
                text-shadow: 
                    0 2px 6px rgba(0, 0, 0, 0.7),
                    0 0 8px rgba(145, 143, 111, 0.3);
            }

            /* Logo Section - Using actual PUC logo */
            .logo-section {
                margin-bottom: 20px;
                position: relative;
            }

            .puc-logo {
                width: 140px;
                height: 140px;
                filter: 
                    drop-shadow(0 6px 20px rgba(0, 0, 0, 0.6))
                    drop-shadow(0 0 15px rgba(145, 143, 111, 0.2));
            }

            /* Month Display */
            .month-display {
                font-family: 'Orbitron', monospace;
                font-size: 36px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 25px;
                text-shadow: 
                    0 0 20px rgba(255, 255, 255, 0.4),
                    0 2px 8px rgba(0, 0, 0, 0.8);
                letter-spacing: 3px;
                text-align: center;
            }

            /* Main Content Area - Matching your tactical styling */
            .main-content {
                background: 
                    linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(26, 26, 26, 0.5) 50%, rgba(0, 0, 0, 0.8) 100%),
                    linear-gradient(45deg, rgba(145, 143, 111, 0.03) 0%, transparent 25%, rgba(145, 143, 111, 0.02) 75%, transparent 100%);
                border: 2px solid rgba(145, 143, 111, 0.4);
                border-radius: 15px;
                padding: 30px 25px;
                width: 100%;
                max-width: 480px;
                margin-bottom: 25px;
                backdrop-filter: blur(10px);
                box-shadow: 
                    0 10px 30px rgba(0, 0, 0, 0.5),
                    0 4px 15px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
                position: relative;
            }

            .main-content::before {
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                right: -1px;
                bottom: -1px;
                background: linear-gradient(45deg, rgba(145, 143, 111, 0.2) 0%, transparent 25%, rgba(145, 143, 111, 0.1) 50%, transparent 75%, rgba(145, 143, 111, 0.2) 100%);
                border-radius: 15px;
                z-index: -1;
            }

            .user-name {
                font-size: 32px;
                font-weight: 800;
                color: #ffffff;
                margin-bottom: 25px;
                text-align: center;
                text-shadow: 
                    0 2px 10px rgba(0, 0, 0, 0.8),
                    0 0 5px rgba(255, 255, 255, 0.1);
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            /* Stats Boxes - Exactly like your examples */
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
                    linear-gradient(135deg, #a19f7f 0%, #918f6f 25%, #8a8764 50%, #918f6f 75%, #a19f7f 100%),
                    linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%);
                border-radius: 30px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #000000;
                position: relative;
                box-shadow: 
                    0 6px 20px rgba(145, 143, 111, 0.5),
                    0 2px 8px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
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

            /* Progress Section - Dynamic messaging */
            .progress-section {
                margin-bottom: 30px;
                text-align: center;
            }

            .pullup-increase {
                font-size: 36px;
                font-weight: 900;
                color: #00ff88;
                text-shadow: 
                    0 0 20px rgba(0, 255, 136, 0.8),
                    0 0 40px rgba(0, 255, 136, 0.4),
                    0 0 60px rgba(0, 255, 136, 0.2),
                    0 3px 8px rgba(0, 0, 0, 0.8);
                letter-spacing: 3px;
                text-transform: uppercase;
                background: linear-gradient(45deg, #00ff88, #00cc6a, #00ff88);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .first-month-badge {
                font-size: 32px;
                font-weight: 900;
                color: #ffd700;
                text-shadow: 
                    0 0 20px rgba(255, 215, 0, 0.8),
                    0 0 40px rgba(255, 215, 0, 0.4),
                    0 3px 8px rgba(0, 0, 0, 0.8);
                letter-spacing: 2px;
                background: linear-gradient(45deg, #ffd700, #ffed4a, #ffd700);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .keep-pushing {
                font-size: 28px;
                font-weight: 800;
                color: #918f6f;
                letter-spacing: 3px;
                text-transform: uppercase;
                text-shadow: 
                    0 3px 8px rgba(0, 0, 0, 0.8),
                    0 0 10px rgba(145, 143, 111, 0.3);
            }

            /* Badge Section - Real badge images */
            .badge-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-top: auto;
                padding-bottom: 20px;
            }

            .badge-image {
                width: 100px;
                height: 100px;
                margin-bottom: 12px;
                filter: 
                    drop-shadow(0 6px 20px rgba(0, 0, 0, 0.7))
                    drop-shadow(0 0 15px rgba(145, 143, 111, 0.3))
                    drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5))
                    brightness(1.1)
                    contrast(1.1);
                border-radius: 50%;
                border: 2px solid rgba(145, 143, 111, 0.2);
            }

            .badge-name {
                font-size: 32px;
                font-weight: 900;
                color: #ffffff;
                letter-spacing: 4px;
                text-shadow: 
                    0 3px 12px rgba(0, 0, 0, 0.9),
                    0 0 8px rgba(255, 255, 255, 0.2),
                    0 1px 3px rgba(145, 143, 111, 0.5);
                text-transform: uppercase;
                margin-bottom: 5px;
            }

            /* Tactical corner decorations */
            .corner-decoration {
                position: absolute;
                width: 50px;
                height: 50px;
                border: 3px solid rgba(145, 143, 111, 0.6);
                z-index: 3;
            }

            .corner-decoration::before {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                border: 1px solid rgba(145, 143, 111, 0.4);
            }

            .corner-decoration.top-left {
                top: 15px;
                left: 15px;
                border-right: none;
                border-bottom: none;
                border-top-left-radius: 3px;
            }

            .corner-decoration.top-left::before {
                top: 10px;
                left: 10px;
                border-right: none;
                border-bottom: none;
            }

            .corner-decoration.top-right {
                top: 15px;
                right: 15px;
                border-left: none;
                border-bottom: none;
                border-top-right-radius: 3px;
            }

            .corner-decoration.top-right::before {
                top: 10px;
                right: 10px;
                border-left: none;
                border-bottom: none;
            }

            .corner-decoration.bottom-left {
                bottom: 15px;
                left: 15px;
                border-right: none;
                border-top: none;
                border-bottom-left-radius: 3px;
            }

            .corner-decoration.bottom-left::before {
                bottom: 10px;
                left: 10px;
                border-right: none;
                border-top: none;
            }

            .corner-decoration.bottom-right {
                bottom: 15px;
                right: 15px;
                border-left: none;
                border-top: none;
                border-bottom-right-radius: 3px;
            }

            .corner-decoration.bottom-right::before {
                bottom: 10px;
                right: 10px;
                border-left: none;
                border-top: none;
            }
        </style>
    </head>
    <body>
        <div class="graphic-container">
            <!-- Tactical corner decorations -->
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

                <!-- Logo - Using your actual logo -->
                <div class="logo-section">
                    <img src="${logoUrl}" alt="Pull-Up Club Logo" class="puc-logo" crossorigin="anonymous" />
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

                    <!-- Stats Boxes - Matching your examples -->
                    <div class="stats-container">
                        <div class="stat-box">
                            <div class="stat-icon">🏦</div>
                            <div class="stat-label">EARNINGS</div>
                            <div class="stat-value">$${data.total_earned || 0}</div>
                        </div>
                        <div class="stat-box">
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

                <!-- Badge Section - Using your actual badge images -->
                <div class="badge-section">
                    <img src="${badgeImageUrl}" alt="${data.current_badge_name} Badge" class="badge-image" crossorigin="anonymous" />
                    <div class="badge-name">${data.current_badge_name?.toUpperCase() || 'RECRUIT'}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

function getSupabaseBadgeImageUrl(badgeName: string, gender: string): string {
  const baseUrl = 'https://yqnikgupiaghgjtsaypr.supabase.co/storage/v1/object/public/graphics-assets';
  const genderFolder = gender?.toLowerCase() === 'female' ? 'female' : 'male';
  const badgeFile = badgeName?.toLowerCase() || 'recruit';
  
  // Map extensions correctly based on uploaded files
  const extensionMap: { [key: string]: string } = {
    'recruit': gender?.toLowerCase() === 'female' ? 'webp' : 'png',
    'hardened': 'png', // Both genders use PNG for hardened
    'operator': gender?.toLowerCase() === 'female' ? 'webp' : 'png', 
    'proven': gender?.toLowerCase() === 'female' ? 'webp' : 'png',
    'elite': gender?.toLowerCase() === 'female' ? 'webp' : 'png'
  };
  
  const extension = extensionMap[badgeFile] || 'png';
  return `${baseUrl}/badges/${genderFolder}/${badgeFile}.${extension}`;
}

function getSupabaseLogoUrl(): string {
  return 'https://yqnikgupiaghgjtsaypr.supabase.co/storage/v1/object/public/graphics-assets/logos/puc-logo.webp';
}

function formatMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
