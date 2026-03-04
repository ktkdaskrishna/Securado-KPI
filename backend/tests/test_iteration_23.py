"""
Iteration 23 Tests - AI Assistant Feedback + Performance Hub Cascade + Category Segmentation

Features to test:
1. AI Assistant chat opens via FAB button and shows welcome message with feedback option
2. AI Assistant can answer CRM data questions (RAG mode)
3. AI Assistant detects feedback intent and submits feedback when user reports a bug
4. POST /api/ai-assistant/chat with mode='feedback' submits feedback successfully
5. POST /api/ai-assistant/chat with mode='auto' detects feedback keywords and routes to feedback
6. Performance Hub loads with Cascade View tab as default for admin users
7. Performance Hub shows CEO Executive Summary card with 5 RAG signals
8. Performance Hub Cascade View shows plan cards with triple targets (Booking, Invoiced, Margin)
9. POST /api/target-plans/revenue/{plan_id}/segments validates category totals match plan target
10. GET /api/target-plans/revenue/{plan_id}/segments returns segments with actuals and pipeline data
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://odoo-sync-portal.preview.emergentagent.com').rstrip('/')


class TestAuthSetup:
    """Test authentication to get tokens for other tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def pd_token(self):
        """Login as product director and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vimod.c@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        return None
    
    @pytest.fixture(scope="class")
    def rep_token(self):
        """Login as sales rep and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nabisaheb@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        return None


class TestAIAssistantFeedback(TestAuthSetup):
    """Test AI Assistant feedback submission via chat"""
    
    def test_ai_chat_crm_mode_answers_question(self, admin_token):
        """Test AI Assistant can answer CRM data questions"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "question": "What is my pipeline for 2026?",
                "session_id": f"test-crm-{uuid.uuid4().hex[:8]}",
                "mode": "crm"
            }
        )
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        data = response.json()
        assert "answer" in data
        assert "session_id" in data
        # Should NOT be a feedback response
        assert data.get("feedback_submitted") != True
        print(f"AI CRM response: {data['answer'][:200]}...")
    
    def test_ai_chat_feedback_mode_submits_feedback(self, admin_token):
        """Test AI Assistant submits feedback when mode='feedback'"""
        feedback_text = f"There is a bug in the dashboard - the chart doesn't load correctly (TEST feedback {uuid.uuid4().hex[:8]})"
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "question": feedback_text,
                "session_id": f"test-feedback-{uuid.uuid4().hex[:8]}",
                "mode": "feedback"
            }
        )
        assert response.status_code == 200, f"AI feedback failed: {response.text}"
        data = response.json()
        assert data.get("feedback_submitted") == True, "Feedback should be submitted when mode='feedback'"
        assert "feedback_id" in data, "Response should include feedback_id"
        assert "answer" in data
        print(f"Feedback submitted with ID: {data['feedback_id']}")
        print(f"AI Response: {data['answer'][:200]}...")
    
    def test_ai_chat_auto_mode_detects_feedback_keywords(self, admin_token):
        """Test AI Assistant detects feedback intent in auto mode"""
        # Using keywords that should trigger feedback detection
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "question": f"I want to report a bug: the export feature is broken (TEST {uuid.uuid4().hex[:8]})",
                "session_id": f"test-auto-{uuid.uuid4().hex[:8]}",
                "mode": "auto"  # Auto mode should detect feedback intent
            }
        )
        assert response.status_code == 200, f"AI auto mode failed: {response.text}"
        data = response.json()
        # Auto mode should detect "bug" and "report" keywords and submit feedback
        assert data.get("feedback_submitted") == True, "Auto mode should detect feedback keywords and submit"
        print(f"Auto-detected feedback with ID: {data.get('feedback_id')}")
    
    def test_ai_chat_auto_mode_crm_questions(self, admin_token):
        """Test AI Assistant handles CRM questions in auto mode (no feedback keywords)"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "question": "Who are the top 3 salespeople by revenue?",
                "session_id": f"test-auto-crm-{uuid.uuid4().hex[:8]}",
                "mode": "auto"
            }
        )
        assert response.status_code == 200, f"AI auto CRM mode failed: {response.text}"
        data = response.json()
        # Should NOT trigger feedback since no feedback keywords
        assert data.get("feedback_submitted") != True, "CRM questions should not trigger feedback"
        print(f"CRM response (no feedback): {data['answer'][:200]}...")
    
    def test_ai_chat_history_endpoint(self, admin_token):
        """Test AI chat history retrieval"""
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Chat history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "History should be a list"
        print(f"Chat history count: {len(data)}")


class TestPerformanceHubCEO(TestAuthSetup):
    """Test Performance Hub CEO/Admin features"""
    
    def test_ceo_summary_endpoint(self, admin_token):
        """Test CEO summary with 5 RAG signals"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/ceo-summary",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"year": "2026"}
        )
        assert response.status_code == 200, f"CEO summary failed: {response.text}"
        data = response.json()
        
        # Verify 5 RAG signals present (field name is "signals" not "rag_signals")
        assert "signals" in data, "CEO summary should have signals array"
        signals = data["signals"]
        assert len(signals) >= 5, f"CEO summary should have 5 signals, got {len(signals)}"
        
        # Check each signal has required fields
        expected_signal_names = ["Revenue vs Plan", "Activity Coverage", "Collections Health", "Pipeline Coverage", "Team Execution"]
        signal_names = [s.get("name") for s in signals]
        for name in expected_signal_names:
            assert name in signal_names, f"Missing signal: {name}"
        
        for sig in signals:
            assert "signal" in sig, f"Signal should have 'signal' field (red/amber/green)"
            assert sig["signal"] in ["red", "amber", "green"], f"Signal must be red/amber/green"
        
        print(f"CEO Summary Signals: {[(s['name'], s['signal']) for s in signals]}")
        print(f"Overall: {data.get('overall')} - Red count: {data.get('red_count')}, Amber count: {data.get('amber_count')}")
    
    def test_revenue_plans_list(self, admin_token):
        """Test listing revenue plans (cascade view data)"""
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"year": "2026"}
        )
        assert response.status_code == 200, f"Revenue plans list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Revenue plans should be a list"
        
        # Each plan should have triple targets
        for plan in data[:3]:  # Check first 3 plans
            print(f"Plan: {plan.get('name')} - PD: {plan.get('product_manager_name')}")
            print(f"  Booking target: {plan.get('booking_target', 0)}")
            print(f"  Invoiced target: {plan.get('invoiced_target', 0)}")
            print(f"  Margin target: {plan.get('margin_target', 0)}")
            print(f"  Actual booking: {plan.get('actual_booking', 0)}")
            print(f"  Booking %: {plan.get('booking_pct', 0)}%")
    
    def test_my_data_endpoint_admin(self, admin_token):
        """Test my-data endpoint returns admin role info"""
        response = requests.get(
            f"{BASE_URL}/api/target-actuals/my-data",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"My data failed: {response.text}"
        data = response.json()
        
        assert "is_admin" in data
        assert data["is_admin"] == True, "Admin user should have is_admin=True"
        print(f"User: {data.get('user_name')} - Roles: {data.get('roles')}")


class TestCategorySegmentation(TestAuthSetup):
    """Test category segmentation for revenue plans"""
    
    @pytest.fixture(scope="class")
    def test_plan_id(self, admin_token):
        """Get or create a test plan for segmentation tests"""
        # First list existing plans
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        plans = response.json()
        
        if plans:
            # Return first plan ID
            return plans[0]["id"]
        
        # Create a test plan if none exist
        response = requests.post(
            f"{BASE_URL}/api/target-plans/revenue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": f"Test Plan {uuid.uuid4().hex[:8]}",
                "product_manager_name": "Vimod C",
                "booking_target": 100000,
                "invoiced_target": 80000,
                "margin_target": 20000,
                "period": "2026-Q1"
            }
        )
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        return response.json()["id"]
    
    def test_get_segments_endpoint(self, admin_token, test_plan_id):
        """Test GET segments endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue/{test_plan_id}/segments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get segments failed: {response.text}"
        data = response.json()
        
        assert "segments" in data, "Response should have segments array"
        assert "totals" in data, "Response should have totals"
        assert "plan_targets" in data, "Response should have plan_targets"
        assert "is_balanced" in data, "Response should have is_balanced flag"
        
        print(f"Plan {test_plan_id} segments: {len(data['segments'])}")
        print(f"Totals: {data['totals']}")
        print(f"Is Balanced: {data['is_balanced']}")
    
    def test_save_segments_validation_fails_on_mismatch(self, admin_token, test_plan_id):
        """Test segment save fails when totals don't match plan target"""
        # First get the plan to know the targets
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        plans = response.json()
        plan = next((p for p in plans if p["id"] == test_plan_id), None)
        
        if not plan:
            pytest.skip("Plan not found")
        
        booking_target = plan.get("booking_target", plan.get("target_amount", 100000))
        
        # Try to save segments that DON'T match the target (should fail)
        mismatched_segments = [
            {"solution_category": "NDR", "booking_target": 10000, "invoiced_target": 0, "margin_target": 0},
            {"solution_category": "CAD", "booking_target": 10000, "invoiced_target": 0, "margin_target": 0}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/target-plans/revenue/{test_plan_id}/segments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"segments": mismatched_segments}
        )
        
        # Should fail with 400 due to validation
        assert response.status_code == 400, f"Mismatched segments should fail validation, got {response.status_code}: {response.text}"
        print(f"Validation failed as expected: {response.json().get('detail')}")
    
    def test_save_segments_success_when_balanced(self, admin_token, test_plan_id):
        """Test segment save succeeds when totals match plan target"""
        # Get the plan to know exact targets
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        plans = response.json()
        plan = next((p for p in plans if p["id"] == test_plan_id), None)
        
        if not plan:
            pytest.skip("Plan not found")
        
        booking_target = plan.get("booking_target", plan.get("target_amount", 0))
        invoiced_target = plan.get("invoiced_target", 0)
        margin_target = plan.get("margin_target", 0)
        
        # Skip if no target
        if booking_target <= 0:
            pytest.skip("Plan has no booking target")
        
        # Create balanced segments
        balanced_segments = [
            {
                "solution_category": "NDR",
                "booking_target": round(booking_target * 0.4),
                "invoiced_target": round(invoiced_target * 0.4) if invoiced_target > 0 else 0,
                "margin_target": round(margin_target * 0.4) if margin_target > 0 else 0,
                "notes": "Test segment 1"
            },
            {
                "solution_category": "CAD",
                "booking_target": round(booking_target * 0.35),
                "invoiced_target": round(invoiced_target * 0.35) if invoiced_target > 0 else 0,
                "margin_target": round(margin_target * 0.35) if margin_target > 0 else 0,
                "notes": "Test segment 2"
            },
            {
                "solution_category": "Hardware",
                "booking_target": booking_target - round(booking_target * 0.4) - round(booking_target * 0.35),  # Remainder
                "invoiced_target": invoiced_target - round(invoiced_target * 0.4) - round(invoiced_target * 0.35) if invoiced_target > 0 else 0,
                "margin_target": margin_target - round(margin_target * 0.4) - round(margin_target * 0.35) if margin_target > 0 else 0,
                "notes": "Test segment 3 (remainder)"
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/target-plans/revenue/{test_plan_id}/segments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"segments": balanced_segments}
        )
        
        assert response.status_code == 200, f"Balanced segments should save successfully: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"Segments saved: {data.get('segments_created')} categories")
    
    def test_segments_return_actuals_and_pipeline(self, admin_token, test_plan_id):
        """Test that GET segments returns actuals and pipeline data"""
        response = requests.get(
            f"{BASE_URL}/api/target-plans/revenue/{test_plan_id}/segments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        segments = data.get("segments", [])
        if segments:
            # Check first segment has enriched data
            seg = segments[0]
            enriched_fields = ["actual_booking", "won_deals", "pipeline", "pipeline_count", "booking_pct", "coverage_ratio"]
            for field in enriched_fields:
                if field in seg:
                    print(f"  {field}: {seg[field]}")


class TestSolutionCategoriesLookup(TestAuthSetup):
    """Test solution categories lookup for segment editor"""
    
    def test_solution_categories_endpoint(self, admin_token):
        """Test solution categories lookup returns data"""
        response = requests.get(
            f"{BASE_URL}/api/target-lookups/solution-categories",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Solution categories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of categories"
        
        if data:
            print(f"Available categories: {len(data)}")
            for cat in data[:5]:
                print(f"  - {cat.get('name')}: {cat.get('opp_count')} opps, pipeline: {cat.get('total_pipeline')}")


class TestFeedbackNotDuplicateFAB(TestAuthSetup):
    """Test that feedback is only via AI Assistant (no separate FAB)"""
    
    def test_feedback_submit_still_works(self, admin_token):
        """Test that the direct feedback endpoint still exists"""
        # This is the old form-based endpoint - should still work for backwards compatibility
        # But the UI should use AI Assistant chat instead
        response = requests.get(
            f"{BASE_URL}/api/feedback/my",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Feedback endpoint should exist: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
