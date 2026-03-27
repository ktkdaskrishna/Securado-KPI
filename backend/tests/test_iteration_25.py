"""
Iteration 25 Backend Tests - AI Assistant Enhancements
Tests: Voice input, file attachments in feedback, inline charts, export chat, MS SSO credentials
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAiAssistantVoiceEndpoint:
    """Test POST /api/ai-assistant/voice endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_voice_endpoint_exists(self):
        """Verify POST /api/ai-assistant/voice endpoint exists and returns expected error format for empty audio"""
        # Send minimal/empty audio to test endpoint existence
        files = {"audio": ("test.webm", b"", "audio/webm")}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/voice",
            headers=self.headers,
            files=files
        )
        # Should return 200 with error in response body (not 404/405)
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert "error" in data or data.get("text") == ""
        print(f"Voice endpoint response: {data}")
    
    def test_voice_endpoint_validates_audio_format(self):
        """Verify endpoint validates audio format"""
        # Send text file as audio (wrong format)
        files = {"audio": ("test.txt", b"not audio content", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/voice",
            headers=self.headers,
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data or data.get("text") == ""
        print(f"Invalid format response: {data}")


class TestFeedbackWithAttachment:
    """Test POST /api/ai-assistant/feedback-with-attachment endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_feedback_with_no_attachment(self):
        """Submit feedback without attachments"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/feedback-with-attachment",
            headers=self.headers,
            data={
                "question": "TEST_feedback_iteration25_no_attachment",
                "session_id": "test-session-25"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("feedback_submitted") is True
        assert "feedback_id" in data
        assert data.get("attachments") == 0
        print(f"Feedback submitted: {data}")
    
    def test_feedback_with_screenshot_attachment(self):
        """Submit feedback with a screenshot attachment"""
        # Create a minimal PNG image (1x1 pixel)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = [("screenshots", ("test_screenshot.png", png_data, "image/png"))]
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/feedback-with-attachment",
            headers=self.headers,
            data={
                "question": "TEST_feedback_iteration25_with_screenshot",
                "session_id": "test-session-25-screenshot"
            },
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("feedback_submitted") is True
        assert "feedback_id" in data
        assert data.get("attachments") == 1
        print(f"Feedback with attachment submitted: {data}")
    
    def test_feedback_rejects_non_image_attachment(self):
        """Verify non-image attachments are filtered out"""
        # Send a text file as attachment
        files = [("screenshots", ("test.txt", b"text content", "text/plain"))]
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/feedback-with-attachment",
            headers=self.headers,
            data={
                "question": "TEST_feedback_iteration25_text_file",
                "session_id": "test-session-25-text"
            },
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("feedback_submitted") is True
        # Text file should be filtered out
        assert data.get("attachments") == 0
        print(f"Non-image filtered: {data}")


class TestInlineCharts:
    """Test AI chat returns chart data in ```chart``` block format"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Authentication failed")
    
    def test_pipeline_chart_request(self):
        """Request a pipeline chart and verify response contains chart data"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.headers,
            json={
                "question": "show me a pipeline chart by stage",
                "session_id": "test-chart-session-25",
                "mode": "auto"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        answer = data.get("answer", "")
        # Check if chart block is present
        assert "```chart" in answer, f"Expected chart block in response, got: {answer[:200]}"
        # Verify it's valid JSON in the chart block
        import json
        import re
        chart_match = re.search(r'```chart\s*\n?([\s\S]*?)\n?```', answer)
        assert chart_match, "Could not find chart block"
        chart_json = json.loads(chart_match.group(1))
        assert "type" in chart_json
        assert "data" in chart_json
        assert isinstance(chart_json["data"], list)
        print(f"Chart data: {chart_json}")


class TestMsSsoCredentials:
    """Verify MS SSO credentials are correctly set in backend .env"""
    
    def test_ms_sso_config_endpoint(self):
        """Check MS SSO config endpoint returns correct values"""
        response = requests.get(f"{BASE_URL}/api/auth/microsoft/config")
        # Should return 200 if configured
        if response.status_code == 200:
            data = response.json()
            # Client ID should match expected value
            assert data.get("clientId") == "1c0f219e-99c3-4233-8f36-20d99c478cb5"
            assert data.get("tenantId") == "db98eaa2-c396-4631-af24-ebe233fffe16"
            print(f"MS SSO config: {data}")
        else:
            # Endpoint might not exist or SSO not configured
            print(f"MS SSO config endpoint status: {response.status_code}")


class TestAiChatBasicFunctionality:
    """Test basic AI chat functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "krishna@securado.net",
            "password": "test123456"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        else:
            pytest.skip("Authentication failed")
    
    def test_chat_basic_question(self):
        """Basic CRM question"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.headers,
            json={
                "question": "What is my current pipeline for 2026?",
                "session_id": "test-basic-chat-25",
                "mode": "auto"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["answer"]) > 10
        print(f"Chat response length: {len(data['answer'])} chars")
    
    def test_chat_history_endpoint(self):
        """Test chat history endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/history",
            headers=self.headers,
            params={"session_id": "test-basic-chat-25"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Chat history items: {len(data)}")


class TestCleanupTestData:
    """Cleanup TEST_ prefixed feedback items"""
    
    def test_cleanup(self):
        """Note: Cleanup would require admin access to delete feedback items"""
        # Just log that test data was created
        print("TEST_ prefixed feedback items created during testing")
        print("Cleanup can be done manually if needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
