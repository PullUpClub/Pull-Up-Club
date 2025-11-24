import React from 'react';
import Header from './Header';
import Footer from './Footer';
import AnalyticsWrapper from './AnalyticsWrapper';

interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showFooter = true }) => {
  return (
    <AnalyticsWrapper>
      <div className="flex flex-col min-h-screen bg-black">
        <Header />
        <main className="flex-grow flex flex-col">{children}</main>
        {showFooter && <Footer />}
      </div>
    </AnalyticsWrapper>
  );
};

export default Layout;