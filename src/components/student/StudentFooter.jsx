import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import '../../styles/student/StudentFooter.css';

export default function StudentFooter() {
  const navigate = useNavigate();

  return (
    <footer className="student-footer-root" role="contentinfo">
      <div className="student-footer-inner">
        {/* Top 4 Columns */}
        <div className="student-footer-grid">
          {/* Column 1: Mission Statement */}
          <div className="student-footer-col">
            <p className="student-footer-desc">
              A online portal to streamlines the credential request process
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="student-footer-col">
            <h4 className="student-footer-title">Quick Links</h4>
            <ul className="student-footer-links">
              <li>
                <Link to={ROUTES.STUDENT.DASHBOARD} className="student-footer-link">
                  Home
                </Link>
              </li>
              <li>
                <Link to={ROUTES.STUDENT.NEW_REQUEST} className="student-footer-link">
                  Request Document
                </Link>
              </li>
              <li>
                <Link to={ROUTES.STUDENT.REQUESTS} className="student-footer-link">
                  Track Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="student-footer-col">
            <h4 className="student-footer-title">Support</h4>
            <ul className="student-footer-links">
              <li>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.STUDENT.NEW_REQUEST)}
                  className="student-footer-link"
                >
                  How it Works
                </button>
              </li>
              <li>
                <span className="student-footer-link">Safety Quidlines</span>
              </li>
              <li>
                <span className="student-footer-link">FAQ</span>
              </li>
              <li>
                <span className="student-footer-link">Contact US</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Connect With Us */}
          <div className="student-footer-col">
            <h4 className="student-footer-title">Connect With Us</h4>
            <div className="student-footer-address">
              <p>USTP Campus</p>
              <p>Cagayn de Oro City, Philippines</p>
            </div>
          </div>
        </div>

        {/* Bottom Row: Copyright on Left, Terms & Privacy on Right */}
        <div className="student-footer-bottom">
          <p className="student-footer-copyright">
            &copy; 2025 Rent-IT. All rights reserved.
          </p>

          <div className="student-footer-legal-links">
            <span className="student-footer-legal-link">Terms of Service</span>
            <span className="student-footer-legal-link">Privacy Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
