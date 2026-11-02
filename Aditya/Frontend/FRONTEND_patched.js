
      function switchSnapDashboard(type) {

          var dashboards = [
              "testerDashboard",
              "managerDashboard",
              "deliveryDashboard"
          ];

          var options = [
              "dashboardOptionTester",
              "dashboardOptionManager",
              "dashboardOptionDelivery"
          ];

          var activeOptionClasses = [
              "border-[#2563eb]",
              "bg-[#f7faff]",
              "shadow-[0_0_0_2px_rgba(37,99,235,.08),0_8px_24px_rgba(37,99,235,.08)]",
              "after:content-['']",
              "after:absolute",
              "after:left-[18px]",
              "after:right-[18px]",
              "after:bottom-[-1px]",
              "after:h-[3px]",
              "after:rounded-[3px_3px_0_0]",
              "after:bg-[#2563eb]"
          ];

          var activeCheckClasses = [
              "bg-[#2563eb]",
              "border-[#2563eb]",
              "text-white"
          ];

          dashboards.forEach(function (id) {

              var element = document.getElementById(id);

              if (element) {
                  element.classList.add("hidden");
                  element.classList.remove("block");
              }
          });

          options.forEach(function (id) {

              var element = document.getElementById(id);

              if (element) {
                  activeOptionClasses.forEach(function (className) {
                      element.classList.remove(className);
                  });

                  var check = element.querySelector("[data-dashboard-check]");

                  if (check) {
                      activeCheckClasses.forEach(function (className) {
                          check.classList.remove(className);
                      });
                  }
              }
          });

          var dashboardId = type + "Dashboard";
          var optionId = "dashboardOption" +
              type.charAt(0).toUpperCase() + type.slice(1);

          var dashboard = document.getElementById(dashboardId);
          var option = document.getElementById(optionId);

          if (dashboard) {
              dashboard.classList.remove("hidden");
              dashboard.classList.add("block");
          }

          if (option) {
              activeOptionClasses.forEach(function (className) {
                  option.classList.add(className);
              });

              var check = option.querySelector(".dashboard-selected-check");

              if (check) {
                  activeCheckClasses.forEach(function (className) {
                      check.classList.add(className);
                  });
              }
          }
      }


      /* =========================================================
         DOWNLOAD REPORT (dashboard -> PDF)
         Captures only the currently active role dashboard
         (#testerDashboard / #managerDashboard / #deliveryDashboard)
         - not the whole SNAP Dashboard page (title, role switcher,
         etc.). The chatbot launcher/panel (#divchatbot) lives
         entirely outside these elements, so it is naturally left
         out of the capture; it is also explicitly hidden for the
         duration of the capture as a belt-and-braces guard.
         ========================================================= */

      function getActiveSnapDashboard() {

          const dashboards = [
              { id: "testerDashboard", label: "Tester" },
              { id: "managerDashboard", label: "Manager" },
              { id: "deliveryDashboard", label: "Delivery" }
          ];

          for (const dashboard of dashboards) {

              const el = document.getElementById(dashboard.id);

              if (el && getComputedStyle(el).display !== "none") {
                  return { el: el, label: dashboard.label };
              }
          }

          return null;
      }

      async function downloadSnapDashboardReport() {

          const active = getActiveSnapDashboard();

          if (!active) {

              const errorBar = document.getElementById("ErrorMessageBar");
              const errorText = document.getElementById("error-message");

              if (errorBar && errorText) {
                  errorText.textContent = "Select a dashboard (Tester / Manager / Delivery) before downloading a report.";
                  errorBar.style.display = "flex";
                  setTimeout(function () {
                      errorBar.style.display = "none";
                  }, 3000);
              }

              return;
          }

          const target = active.el;

          const chatbotRoot = document.getElementById("divchatbot");
          const chatbotPrevDisplay = chatbotRoot ? chatbotRoot.style.display : null;

          const btn = document.getElementById("btnDownloadDashboardReport");
          if (btn) {
              btn.disabled = true;
          }

          // the dashboard root scrolls internally (overflow-y-auto capped
          // to the viewport) - relax that for the capture so html2canvas
          // sees the full content height, not just what's currently
          // scrolled into view
          const prevOverflow = target.style.overflow;
          const prevHeight = target.style.height;
          const prevMaxHeight = target.style.maxHeight;

          try {

              if (typeof showWaiting === "function") {
                  showWaiting("Generating report...");
              }

              if (chatbotRoot) {
                  chatbotRoot.style.display = "none";
              }

              target.style.overflow = "visible";
              target.style.height = "auto";
              target.style.maxHeight = "none";

              // let the waiting overlay (and the style changes above)
              // actually paint before the (synchronous, potentially
              // slow) capture work starts
              await new Promise(function (resolve) {
                  setTimeout(resolve, 50);
              });

              const fullHeight = target.scrollHeight;
              const fullWidth = target.scrollWidth;

              const canvas = await html2canvas(target, {
                  scale: 2,
                  useCORS: true,
                  backgroundColor: "#f5f7fb",
                  windowWidth: fullWidth,
                  windowHeight: fullHeight,
                  height: fullHeight,
                  width: fullWidth
              });

              const jsPDF = window.jspdf.jsPDF;
              const pdf = new jsPDF({
                  orientation: "portrait",
                  unit: "mm",
                  format: "a4"
              });

              const pageWidthMm = pdf.internal.pageSize.getWidth();
              const pageHeightMm = pdf.internal.pageSize.getHeight();

              const imgWidthMm = pageWidthMm;
              const pageHeightPx = (pageHeightMm * canvas.width) / imgWidthMm;

              let renderedHeightPx = 0;
              let firstPage = true;

              while (renderedHeightPx < canvas.height) {

                  const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);

                  const pageCanvas = document.createElement("canvas");
                  pageCanvas.width = canvas.width;
                  pageCanvas.height = sliceHeightPx;

                  const pageCtx = pageCanvas.getContext("2d");
                  // canvas defaults to transparent black; paint the same
                  // background so a JPEG re-encode doesn't turn it black
                  pageCtx.fillStyle = "#f5f7fb";
                  pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                  pageCtx.drawImage(
                      canvas,
                      0, renderedHeightPx, canvas.width, sliceHeightPx,
                      0, 0, canvas.width, sliceHeightPx
                  );

                  const sliceHeightMm = (sliceHeightPx * imgWidthMm) / canvas.width;

                  if (!firstPage) {
                      pdf.addPage();
                  }

                  pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgWidthMm, sliceHeightMm);

                  renderedHeightPx += sliceHeightPx;
                  firstPage = false;
              }

              const stamp = new Date().toISOString().slice(0, 10);
              pdf.save("SNAP-" + active.label + "-Dashboard-Report-" + stamp + ".pdf");

          } catch (err) {

              console.error("Failed to generate dashboard report:", err);

              const errorBar = document.getElementById("ErrorMessageBar");
              const errorText = document.getElementById("error-message");

              if (errorBar && errorText) {
                  errorText.textContent = "Failed to generate the dashboard report. Please try again.";
                  errorBar.style.display = "flex";
                  setTimeout(function () {
                      errorBar.style.display = "none";
                  }, 3000);
              }

          } finally {

              target.style.overflow = prevOverflow;
              target.style.height = prevHeight;
              target.style.maxHeight = prevMaxHeight;

              if (chatbotRoot) {
                  chatbotRoot.style.display = chatbotPrevDisplay || "";
              }

              if (btn) {
                  btn.disabled = false;
              }

              if (typeof hideWaiting === "function") {
                  hideWaiting();
              }
          }
      }


      /* =========================================================
         CHART INITIALIZATION
         ========================================================= */

      document.addEventListener("DOMContentLoaded", function () {

          /*
           * SNAP AI CHATBOT
           * Only present in the Dashboard view's markup - run
           * this first so a Chart.js failure below (missing
           * canvas library, blocked CDN, etc.) can never skip
           * wiring up the chatbot's Escape-to-close handler.
           */

          if (document.getElementById("divchatbot")) {
              initSnapAIChatbot();
          }


          /*
           * TESTER
           * Pass / Fail
           */

          var testerPassFail =
              document.getElementById("testerPassFailChart");

          if (testerPassFail) {

              new Chart(testerPassFail, {

                  type: "doughnut",

                  data: {

                      labels: [
                          "Passed",
                          "Failed"
                      ],

                      datasets: [{

                          data: [
                              15,
                              5
                          ],

                          backgroundColor: [
                              "#42AD3E",
                              "#F73B3B"
                          ],

                          borderWidth: 0,
                          hoverOffset: 5

                      }]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      cutout: "70%",

                      plugins: {

                          legend: {

                              position: "bottom",

                              labels: {

                                  usePointStyle: true,
                                  boxWidth: 7,
                                  padding: 18

                              }

                          }

                      }

                  }

              });

          }


          /*
           * TEST MANAGER
           * Sprint Burndown
           */

          var managerBurndown =
              document.getElementById("managerBurndownChart");

          if (managerBurndown) {

              new Chart(managerBurndown, {

                  type: "line",

                  data: {

                      labels: [
                          "Day 0",
                          "Day 1",
                          "Day 2",
                          "Day 3",
                          "Day 4",
                          "Day 5",
                          "Day 6",
                          "Day 7",
                          "Day 8",
                          "Day 9",
                          "Day 10"
                      ],

                      datasets: [

                          {
                              label: "Ideal",

                              data: [
                                  100,
                                  90,
                                  80,
                                  70,
                                  60,
                                  50,
                                  40,
                                  30,
                                  20,
                                  10,
                                  0
                              ],

                              borderColor: "#aeb5c0",
                              borderDash: [7, 5],
                              borderWidth: 2,
                              pointRadius: 0,
                              tension: 0
                          },


                          {
                              label: "Actual",

                              data: [
                                  100,
                                  94,
                                  87,
                                  80,
                                  74,
                                  68,
                                  62,
                                  55,
                                  null,
                                  null,
                                  null
                              ],

                              borderColor: "#233b68",
                              backgroundColor: "rgba(35,59,104,.05)",
                              borderWidth: 3,
                              pointRadius: 3,
                              tension: .25,
                              fill: false
                          },


                          {
                              label: "Projected",

                              data: [
                                  null,
                                  null,
                                  null,
                                  null,
                                  null,
                                  null,
                                  null,
                                  55,
                                  48,
                                  42,
                                  36
                              ],

                              borderColor: "#dc2626",
                              borderDash: [4, 4],
                              borderWidth: 2,
                              pointRadius: 3,
                              tension: .2,
                              fill: false
                          }

                      ]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      interaction: {
                          intersect: false,
                          mode: "index"
                      },

                      plugins: {

                          legend: {

                              position: "bottom",

                              labels: {
                                  usePointStyle: true,
                                  boxWidth: 7,
                                  padding: 15
                              }

                          }

                      },

                      scales: {

                          x: {
                              grid: {
                                  display: false
                              }
                          },

                          y: {

                              beginAtZero: true,

                              max: 100,

                              ticks: {
                                  precision: 0
                              }

                          }

                      }

                  }

              });

          }


          /*
           * TEST MANAGER
           * Defect Density
           */

          var managerDefect =
              document.getElementById("managerDefectChart");

          if (managerDefect) {

              new Chart(managerDefect, {

                  type: "bar",

                  data: {

                      labels: [
                          "Payment Gateway",
                          "User Authentication",
                          "Notification Service",
                          "Dashboard UI",
                          "Report Export"
                      ],

                      datasets: [{

                          label: "Defect Density",

                          data: [
                              22,
                              17,
                              9,
                              4,
                              2
                          ],

                          backgroundColor: [
                              "#991b1b",
                              "#dc2626",
                              "#f97316",
                              "#4f8a35",
                              "#4f8a35"
                          ],

                          borderRadius: 5,
                          borderWidth: 0

                      }]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      plugins: {

                          legend: {
                              display: false
                          }

                      },

                      scales: {

                          x: {

                              grid: {
                                  display: false
                              },

                              ticks: {
                                  font: {
                                      size: 10
                                  }
                              }

                          },

                          y: {

                              beginAtZero: true,

                              max: 25,

                              ticks: {
                                  callback: function (value) {
                                      return value + "%";
                                  }
                              }

                          }

                      }

                  }

              });

          }


          /*
           * TEST MANAGER
           * Team Performance
           */

          var managerTeam =
              document.getElementById("managerTeamChart");

          if (managerTeam) {

              new Chart(managerTeam, {

                  type: "bar",

                  data: {

                      labels: [
                          "Riya",
                          "Arjun",
                          "Priya",
                          "Dev"
                      ],

                      datasets: [{

                          label: "% Completed",

                          data: [
                              20,
                              45,
                              85,
                              70
                          ],

                          backgroundColor: [
                              "#dc2626",
                              "#dc2626",
                              "#4f8a35",
                              "#4f8a35"
                          ],

                          borderRadius: 5

                      }]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      plugins: {

                          legend: {
                              display: false
                          }

                      },

                      scales: {

                          x: {
                              grid: {
                                  display: false
                              }
                          },

                          y: {

                              beginAtZero: true,

                              max: 100,

                              ticks: {

                                  callback: function (value) {
                                      return value + "%";
                                  }

                              }

                          }

                      }

                  }

              });

          }


          /*
           * TEST MANAGER
           * 3 Sprint Trend
           */

          var managerTrend =
              document.getElementById("managerTrendChart");

          if (managerTrend) {

              new Chart(managerTrend, {

                  type: "line",

                  data: {

                      labels: [
                          "Sprint 2",
                          "Sprint 3",
                          "Sprint 4"
                      ],

                      datasets: [

                          {

                              label: "Velocity",

                              data: [
                                  52,
                                  48,
                                  45
                              ],

                              borderColor: "#233b68",
                              backgroundColor: "transparent",
                              borderWidth: 3,
                              tension: .25,
                              pointRadius: 4
                          },


                          {

                              label: "Bug Count",

                              data: [
                                  18,
                                  23,
                                  27
                              ],

                              borderColor: "#b91c1c",
                              backgroundColor: "transparent",
                              borderWidth: 3,
                              tension: .25,
                              pointRadius: 4
                          },


                          {

                              label: "Pass Rate",

                              data: [
                                  81,
                                  78,
                                  75
                              ],

                              borderColor: "#4f8a35",
                              backgroundColor: "transparent",
                              borderDash: [6, 4],
                              borderWidth: 3,
                              tension: .25,
                              pointRadius: 4,
                              yAxisID: "y1"
                          }

                      ]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      interaction: {
                          intersect: false,
                          mode: "index"
                      },

                      plugins: {

                          legend: {

                              position: "bottom",

                              labels: {
                                  usePointStyle: true,
                                  boxWidth: 7,
                                  padding: 12
                              }

                          }

                      },

                      scales: {

                          x: {
                              grid: {
                                  display: false
                              }
                          },

                          y: {
                              beginAtZero: false
                          },

                          y1: {
                              type: "linear",
                              position: "right",
                              min: 0,
                              max: 100,
                              grid: {
                                  drawOnChartArea: false
                              },
                              ticks: {
                                  callback: function (value) {
                                      return value + "%";
                                  }
                              }
                          }

                      }

                  }

              });

          }


          /*
           * DELIVERY MANAGER
           * Defect Detection Effectiveness
           */

          var deliveryEffectiveness =
              document.getElementById(
                  "deliveryDefectEffectivenessChart"
              );

          if (deliveryEffectiveness) {

              new Chart(deliveryEffectiveness, {

                  type: "doughnut",

                  data: {

                      labels: [
                          "Caught Before Release",
                          "Reported by Client"
                      ],

                      datasets: [{

                          data: [
                              39,
                              11
                          ],

                          backgroundColor: [
                              "#4f8a35",
                              "#dc2626"
                          ],

                          borderWidth: 0,
                          hoverOffset: 5

                      }]

                  },

                  options: {

                      responsive: true,

                      maintainAspectRatio: false,

                      cutout: "70%",

                      plugins: {

                          legend: {

                              position: "bottom",

                              labels: {
                                  usePointStyle: true,
                                  boxWidth: 7,
                                  padding: 13
                              }

                          }

                      }

                  }

              });

          }

      });


      /* =========================================================
         SIMPLE TOAST
         ========================================================= */

      function showSnapDashboardToast(message) {

          var existing =
              document.getElementById("snapDashboardToast");

          if (existing) {
              existing.remove();
          }


          var toast =
              document.createElement("div");

          toast.id =
              "snapDashboardToast";

          toast.innerHTML =
              "✓ &nbsp;" + message;


          toast.className =
              "fixed right-[25px] bottom-[25px] bg-[#111827] text-white px-[18px] py-3 rounded-[9px] text-xs font-[650] z-[99999] shadow-[0_10px_30px_rgba(15,23,42,.18)] transition-opacity duration-300";


          document.body.appendChild(toast);


          setTimeout(function () {

              toast.classList.add("opacity-0");


              setTimeout(function () {

                  if (toast) {
                      toast.remove();
                  }

              }, 300);

          }, 2000);

      }



      /* =========================================================
         SNAP AI CHATBOT
         Moved here from the now-removed chatbot.js. The markup
         these functions operate on lives inside the Dashboard
         view (SaasUI.aspx, #divchatbot), so these are only
         ever exercised when that view has rendered - see the
         initSnapAIChatbot() call above.
         ========================================================= */

    let snapCurrentRole = "home";
    let snapPreviousView = "home";


    /* =========================================================
       OPEN CHATBOT
       ========================================================= */

    function openSnapAI() {

        const panel = document.getElementById("snapAIChatPanel");

        if (panel) {
            panel.classList.add("snap-ai-open");
        }

            }


    /* =========================================================
       CLOSE CHATBOT
       ========================================================= */

    function closeSnapAI() {

        const panel = document.getElementById("snapAIChatPanel");

        if (panel) {
            panel.classList.remove("snap-ai-open");
        }

            }


    /* =========================================================
       VIEW NAVIGATION
       ========================================================= */

    function showSnapView(view) {

                const views = [
    "snapViewHome",
    "snapViewTester",
    "snapViewManager",
    "snapViewDelivery",
    "snapViewAnswer"
    ];

    views.forEach(function (id) {

                    const element =
    document.getElementById(id);

    if (element) {
        element.classList.remove("active");
                    }

                });


    let target = "";


    if (view === "home") {

        target = "snapViewHome";
    snapCurrentRole = "home";

                }


    else if (view === "tester") {

        target = "snapViewTester";
    snapCurrentRole = "tester";

                }


    else if (view === "manager") {

        target = "snapViewManager";
    snapCurrentRole = "manager";

                }


    else if (view === "delivery") {

        target = "snapViewDelivery";
    snapCurrentRole = "delivery";

                }


    else if (view === "answer") {

        target = "snapViewAnswer";

                }


    const targetElement =
    document.getElementById(target);

    if (targetElement) {

        targetElement.classList.add("active");

                }


    document
    .getElementById("snapAIContent")
    .scrollTop = 0;

            }


    /* =========================================================
       SHOW ANSWER
       ========================================================= */

    function showSnapAnswer(role, question) {

        snapPreviousView = role;

    /* =====================================================
       USER QUESTION
       ===================================================== */

    const userQuestion =
    document.getElementById("snapUserQuestion");

    if (userQuestion) {

        userQuestion.innerText =
        getSnapQuestion(role, question);

                }


    /* =====================================================
       CATEGORY
       ===================================================== */

    const category =
    document.getElementById("snapAnswerCategory");

    if (category) {

        category.innerText =
        getSnapRoleName(role);

                }


    /* =====================================================
       TITLE
       ===================================================== */

    const title =
    document.getElementById("snapAnswerTitle");

    if (title) {

        title.innerText =
        getSnapShortTitle(role, question);

                }


    /* =====================================================
       ANSWER
       ===================================================== */

    const answerCard =
    document.getElementById("snapAnswerCard");

    if (answerCard) {

        answerCard.innerHTML =
        getSnapDummyAnswer(role, question);

                }


    /* =====================================================
       FOLLOW-UP QUESTIONS
       ===================================================== */

    renderSnapFollowUpQuestions(role);


    /* =====================================================
       SHOW ANSWER VIEW
       ===================================================== */

    showSnapView("answer");


    /* =====================================================
       SCROLL TO TOP
       ===================================================== */

    setTimeout(function () {

                    const content =
    document.getElementById("snapAIContent");

    if (content) {

        content.scrollTop = 0;

                    }

                }, 50);

            }


    /* =========================================================
   RENDER FOLLOW-UP QUESTIONS
   ========================================================= */

    function renderSnapFollowUpQuestions(role) {

                const container =
    document.getElementById("snapFollowUpQuestions");

    if (!container) {
                    return;
                }


    const questions = getSnapRoleQuestions(role);


    container.innerHTML = "";


    questions.forEach(function (item, index) {

                    const button =
    document.createElement("button");

    button.type = "button";

    button.className =
    "group flex w-full items-center gap-2.5 " +
    "rounded-xl border border-slate-200 " +
    "bg-white p-2.5 text-left " +
    "transition-all duration-200 " +
    "hover:-translate-y-0.5 " +
    "hover:border-blue-300 " +
    "hover:bg-blue-50/30 " +
    "hover:shadow-md";


    button.onclick = function () {

        showSnapAnswer(
            role,
            item.id
        );

                    };


    button.innerHTML = `

    <span
        class="flex h-7 w-7 shrink-0
                       items-center justify-center
                       rounded-lg bg-blue-50
                       text-[9px] font-bold
                       text-blue-600
                       transition
                       group-hover:bg-blue-100">

        Q${index + 1}

    </span>


    <span
        class="flex-1 text-[10.5px]
                       font-semibold leading-4
                       text-slate-600">

        ${item.text}

    </span>


    <span
        class="text-lg leading-none
                       text-slate-300
                       transition
                       group-hover:translate-x-1
                       group-hover:text-blue-500">

        ›

    </span>

    `;


    container.appendChild(button);

                });

            }

    /* =========================================================
   GET ALL QUESTIONS FOR ROLE
   ========================================================= */

    function getSnapRoleQuestions(role) {

                const questions = {

        tester: [

    {
        id: "q1",
    text:
    "What is my sprint progress and am I on track?"
                        },

    {
        id: "q2",
    text:
    "Which of my pending cases carry the highest risk of failure?"
                        },

    {
        id: "q3",
    text:
    "How does my defect detection rate compare to the team?"
                        },

    {
        id: "q4",
    text:
    "What is my overall pass/fail rate this sprint?"
                        }

    ],


    manager: [

    {
        id: "q1",
    text:
    "What is the predicted sprint completion rate at current pace?"
                        },

    {
        id: "q2",
    text:
    "Which module has the highest defect density?"
                        },

    {
        id: "q3",
    text:
    "Which testers are behind schedule and by how much?"
                        },

    {
        id: "q4",
    text:
    "What is the team performance trend over the last 3 sprints?"
                        }

    ],


    delivery: [

    {
        id: "q1",
    text:
    "What is our delivery probability for the current release?"
                        },

    {
        id: "q2",
    text:
    "What is the release risk score and what is driving it?"
                        },

    {
        id: "q3",
    text:
    "Is the quality gate met for release?"
                        },

    {
        id: "q4",
    text:
    "What should be descoped to protect the release deadline?"
                        },

    {
        id: "q5",
    text:
    "What is our defect detection effectiveness?"
                        }

    ]

                };


    return questions[role] || [];

            }

    /* =========================================================
       BACK FROM ANSWER
       ========================================================= */

    function backFromSnapAnswer() {

        showSnapView(snapPreviousView);

            }


    /* =========================================================
       ROLE NAME
       ========================================================= */

    function getSnapRoleName(role) {

                const names = {

        tester: "Tester Insights",

    manager: "Test Manager Insights",

    delivery: "Delivery Manager Insights"

                };

    return names[role] || "SNAP AI";

            }


    /* =========================================================
       QUESTIONS
       ========================================================= */

    function getSnapQuestion(role, q) {

                const questions = {

        tester: {

        q1:
    "What is my sprint progress and am I on track?",

    q2:
    "Which of my pending cases carry the highest risk of failure?",

    q3:
    "How does my defect detection rate compare to the team?",

    q4:
    "What is my overall pass/fail rate this sprint?"

                    },


    manager: {

        q1:
    "What is the predicted sprint completion rate at current pace?",

    q2:
    "Which module has the highest defect density?",

    q3:
    "Which testers are behind schedule and by how much?",

    q4:
    "What is the team performance trend over the last 3 sprints?"

                    },


    delivery: {

        q1:
    "What is our delivery probability for the current release?",

    q2:
    "What is the release risk score and what is driving it?",

    q3:
    "Is the quality gate met for release?",

    q4:
    "What should be descoped to protect the release deadline?",

    q5:
    "What is our defect detection effectiveness?"

                    }

                };

    return questions[role][q];

            }


    /* =========================================================
       SHORT TITLES
       ========================================================= */

    function getSnapShortTitle(role, q) {

                const titles = {

        tester: {

        q1: "Sprint Progress",

    q2: "High-Risk Cases",

    q3: "Defect Detection",

    q4: "Pass / Fail Rate"

                    },


    manager: {

        q1: "Sprint Completion",

    q2: "Defect Density",

    q3: "Schedule Status",

    q4: "Team Performance Trend"

                    },


    delivery: {

        q1: "Delivery Probability",

    q2: "Release Risk",

    q3: "Quality Gate",

    q4: "Descope Recommendation",

    q5: "Detection Effectiveness"

                    }

                };

    return titles[role][q];

            }


    /* =========================================================
       DUMMY ANSWERS
       ========================================================= */

    function getSnapDummyAnswer(role, q) {


                /* =====================================================
    TESTER - Q1
    ===================================================== */

                if (role === "tester" && q === "q1") {

                    return `

    <div class="flex items-center justify-between
                            gap-2 border-b border-slate-100
                            px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Sprint 4 · Current Pace
        </span>

        <span class="rounded-md bg-amber-100
                                 px-2 py-1 text-[8px]
                                 font-bold text-amber-700">
            BORDERLINE
        </span>

    </div>


    <div class="grid grid-cols-2 gap-2 p-2.5">

        <div class="rounded-lg border border-slate-100
                                bg-slate-50/70 p-2.5">

            <div class="text-[8.5px] text-slate-400">
                Sprint Progress
            </div>

            <div class="mt-1 text-[16px]
                                    font-bold text-slate-800">
                53%
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    text-slate-400">
                16 of 30 cases
            </div>

        </div>


        <div class="rounded-lg border border-slate-100
                                bg-slate-50/70 p-2.5">

            <div class="text-[8.5px] text-slate-400">
                Expected Today
            </div>

            <div class="mt-1 text-[16px]
                                    font-bold text-slate-800">
                18
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    text-slate-400">
                Day 6 of 10
            </div>

        </div>


        <div class="rounded-lg border border-slate-100
                                bg-slate-50/70 p-2.5">

            <div class="text-[8.5px] text-slate-400">
                Actual
            </div>

            <div class="mt-1 text-[16px]
                                    font-bold text-slate-800">
                16
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    text-slate-400">
                2 behind pace
            </div>

        </div>


        <div class="rounded-lg border border-slate-100
                                bg-slate-50/70 p-2.5">

            <div class="text-[8.5px] text-slate-400">
                Projected
            </div>

            <div class="mt-1 text-[16px]
                                    font-bold text-slate-800">
                89%
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    text-slate-400">
                Target: 90%
            </div>

        </div>

    </div>


    <div class="mx-2.5 mb-2.5 rounded-lg
                            border border-slate-100 p-2.5">

        <div class="mb-1.5 flex items-center
                                justify-between">

            <span class="text-[9px] text-slate-500">
                Sprint completion
            </span>

            <span class="text-[9px] font-bold
                                     text-slate-700">
                53%
            </span>

        </div>

        <div class="h-1.5 overflow-hidden
                                rounded-full bg-slate-200">

            <div
                class="h-full rounded-full
                                   bg-gradient-to-r
                                   from-blue-600 to-indigo-600"
                style="width:53%">
            </div>

        </div>

    </div>


    <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-amber-200
                            bg-amber-50 p-2.5">

        <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-amber-600">
            ⚠
        </div>

        <div>

            <div class="text-[9.5px] font-bold
                                    text-amber-800">
                2 cases behind pace
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-amber-700/80">

                Projected completion is 89%,
                slightly below the 90% target.

            </div>

        </div>

    </div>


    `;

                }


    /* =====================================================
       TESTER - Q2
       ===================================================== */

    if (role === "tester" && q === "q2") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Pending Cases · Risk Ranking
        </span>

        <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
            HIGH RISK
        </span>

    </div>


    <div class="divide-y divide-slate-100 px-2.5">

        ${snapRiskRow(
            "01",
            "TC-108 · Payment Gateway",
            "Failure rate: 68%",
            "HIGH",
            "red"
        )}

        ${snapRiskRow(
            "02",
            "TC-112 · OTP Timeout",
            "Failure rate: 54%",
            "HIGH",
            "red"
        )}

        ${snapRiskRow(
            "03",
            "TC-119 · Session Expiry",
            "Failure rate: 41%",
            "MEDIUM",
            "amber"
        )}

        ${snapRiskRow(
            "04",
            "TC-103 · UI Label Alignment",
            "Failure rate: 8%",
            "LOW",
            "green"
        )}

    </div>

    `;

                }


    /* =====================================================
       TESTER - Q3
       ===================================================== */

    if (role === "tester" && q === "q3") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Defect Detection Rate
        </span>

        <span class="rounded-md bg-green-100 px-2 py-1
                                 text-[8px] font-bold text-green-700">
            ABOVE AVERAGE
        </span>

    </div>


    <div class="grid grid-cols-2 gap-2 p-2.5">

        ${snapKPI(
            "Your Detection Rate",
            "14%",
            ""
        )}

        ${snapKPI(
            "Team Average",
            "9%",
            ""
        )}

    </div>


    <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-green-200
                            bg-green-50 p-2.5">

        <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-green-600">
            ✓
        </div>

        <div>

            <div class="text-[9.5px] font-bold
                                    text-green-800">
                56% more bugs than team average
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-green-700/80">

                This indicates thorough testing
                on your assigned modules.

            </div>

        </div>

    </div>

    `;

                }


    /* =====================================================
       TESTER - Q4
       ===================================================== */

    if (role === "tester" && q === "q4") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Sprint Pass / Fail
        </span>

        <span class="rounded-md bg-amber-100 px-2 py-1
                                 text-[8px] font-bold text-amber-700">
            BELOW TEAM
        </span>

    </div>


    <div class="grid grid-cols-2 gap-2 p-2.5">

        ${snapKPI(
            "Cases Executed",
            "20",
            ""
        )}

        ${snapKPI(
            "Passed",
            "15",
            "75%"
        )}

        ${snapKPI(
            "Failed",
            "5",
            "25%"
        )}

        ${snapKPI(
            "Team Average",
            "81%",
            ""
        )}

    </div>


    <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-amber-200
                            bg-amber-50 p-2.5">

        <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-amber-600">
            ⚠
        </div>

        <div>

            <div class="text-[9.5px] font-bold
                                    text-amber-800">
                6 points below team average
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-amber-700/80">

                Review failed cases for recurring
                patterns or issues.

            </div>

        </div>

    </div>

    `;

                }


    /* =====================================================
       TEST MANAGER - Q1
       ===================================================== */

    if (role === "manager" && q === "q1") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Sprint 4 · Forecast
        </span>

        <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
            WARNING
        </span>

    </div>


    <div class="grid grid-cols-2 gap-2 p-2.5">

        ${snapKPI(
            "Current",
            "45%",
            ""
        )}

        ${snapKPI(
            "Predicted End",
            "64%",
            ""
        )}

        ${snapKPI(
            "Daily Velocity",
            "6.4",
            "cases/day"
        )}

        ${snapKPI(
            "Days Remaining",
            "3",
            ""
        )}

    </div>


    <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-red-200
                            bg-red-50 p-2.5">

        <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-red-600">
            !
        </div>

        <div>

            <div class="text-[9.5px] font-bold
                                    text-red-800">
                Sprint below 90% target
            </div>

            <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-red-700/80">

                Projected completion is 64 cases,
                leaving a gap of 26 cases.

            </div>

        </div>

    </div>

    `;

                }


    /* =====================================================
       TEST MANAGER - Q2
       ===================================================== */

    if (role === "manager" && q === "q2") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Defect Density
        </span>

        <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
            CRITICAL
        </span>

    </div>


    <div class="px-2.5">

        ${snapRiskRow(
            "01",
            "Payment Gateway",
            "Defect density: 22%",
            "22%",
            "red"
        )}

        ${snapRiskRow(
            "02",
            "User Authentication",
            "Defect density: 17%",
            "17%",
            "red"
        )}

        ${snapRiskRow(
            "03",
            "Notification Service",
            "Defect density: 9%",
            "9%",
            "amber"
        )}

        ${snapRiskRow(
            "04",
            "Dashboard UI",
            "Defect density: 4%",
            "4%",
            "green"
        )}

    </div>


    ${snapRecommendation(
        "Recommendation",
        "Payment Gateway is running at 2× the project average. Increase test coverage immediately."
    )}

    `;

                }


    /* =====================================================
       TEST MANAGER - Q3
       ===================================================== */

    if (role === "manager" && q === "q3") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Team Schedule · Day 6 of 10
        </span>

        <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
            2 BEHIND
        </span>

    </div>


    <div class="px-2.5">

        ${snapRiskRow(
            "R",
            "Riya · 4 / 20 cases",
            "40 pts below target",
            "BEHIND",
            "red"
        )}

        ${snapRiskRow(
            "A",
            "Arjun · 9 / 20 cases",
            "15 pts below target",
            "BEHIND",
            "amber"
        )}

        ${snapRiskRow(
            "P",
            "Priya · 17 / 20 cases",
            "25 pts above target",
            "ON TRACK",
            "green"
        )}

        ${snapRiskRow(
            "D",
            "Dev · 14 / 20 cases",
            "10 pts above target",
            "ON TRACK",
            "green"
        )}

    </div>


    ${snapRecommendation(
        "Action",
        "Riya is critically behind. Recommend an immediate check-in."
    )}

    `;

                }


    /* =====================================================
       TEST MANAGER - Q4
       ===================================================== */

    if (role === "manager" && q === "q4") {

                    return `

    <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

        <span class="text-[11px] font-bold text-slate-700">
            Last 3 Sprint Trend
        </span>

        <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
            NEGATIVE
        </span>

    </div>


    <div class="grid grid-cols-1 gap-2 p-2.5">

        ${snapTrendRow(
            "Sprint 2",
            "52",
            "81%",
            "18"
        )}

        ${snapTrendRow(
            "Sprint 3",
            "48",
            "78%",
            "23"
        )}

        ${snapTrendRow(
            "Sprint 4",
            "45",
            "75%",
            "27"
        )}

    </div>


    <div class="mx-2.5 mb-2.5 rounded-lg
                            border border-red-200 bg-red-50 p-2.5">

        <div class="mb-1 text-[9px] font-bold
                                text-red-800">

            ⚠ Risk Signal

        </div>

        <div class="text-[8.5px] leading-4
                                text-red-700/80">

            Velocity: <strong>-7%</strong> per sprint<br>
                Bug count: <strong>+23%</strong> per sprint<br>
                    Pass rate: <strong>-3%</strong> per sprint

                </div>

        </div>

        `;

                }


        /* =====================================================
           DELIVERY - Q1
           ===================================================== */

        if (role === "delivery" && q === "q1") {

                    return `

        <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

            <span class="text-[11px] font-bold text-slate-700">
                Current Release
            </span>

            <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
                52% PROBABILITY
            </span>

        </div>


        <div class="grid grid-cols-2 gap-2 p-2.5">

            ${snapKPI(
                "Test Coverage",
                "62%",
                "Target: 90%"
            )}

            ${snapKPI(
                "Pass Rate",
                "75%",
                "Target: 85%"
            )}

            ${snapKPI(
                "Sprint Completion",
                "64%",
                "Target: 100%"
            )}

            ${snapKPI(
                "Critical Bugs",
                "3",
                "Target: 0"
            )}

        </div>


        <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-red-200
                            bg-red-50 p-2.5">

            <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-red-600">
                !
            </div>

            <div>

                <div class="text-[9.5px] font-bold
                                    text-red-800">
                    DO NOT RELEASE
                </div>

                <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-red-700/80">

                    All four release indicators are
                    currently below target.

                </div>

            </div>

        </div>


        ${snapRecommendation(
            "Safe Release",
            "Earliest safe release is approximately +6 days if critical bugs are resolved by tomorrow."
        )}

        `;

                }


        /* =====================================================
           DELIVERY - Q2
           ===================================================== */

        if (role === "delivery" && q === "q2") {

                    return `

        <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

            <span class="text-[11px] font-bold text-slate-700">
                Release Risk Score
            </span>

            <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
                HIGH · 6.1 / 10
            </span>

        </div>


        <div class="px-2.5">

            ${snapRiskRow(
                "01",
                "BUG-209 · Unassigned",
                "Open for 4 days · +2.0 pts",
                "+2.0",
                "red"
            )}

            ${snapRiskRow(
                "02",
                "Payment Module Coverage",
                "38% coverage · +2.0 pts",
                "+2.0",
                "red"
            )}

            ${snapRiskRow(
                "03",
                "BUG-201 · No Fix ETA",
                "Open for 6 days · +1.5 pts",
                "+1.5",
                "amber"
            )}

            ${snapRiskRow(
                "04",
                "Critical Bugs",
                "3 still open · +0.6 pts",
                "+0.6",
                "amber"
            )}

        </div>


        ${snapRecommendation(
            "Reduce Risk Below 5.0",
            "Assign BUG-209 today and increase test coverage for the Payment module."
        )}

        `;

                }


        /* =====================================================
           DELIVERY - Q3
           ===================================================== */

        if (role === "delivery" && q === "q3") {

                    return `

        <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

            <span class="text-[11px] font-bold text-slate-700">
                Release Quality Gate
            </span>

            <span class="rounded-md bg-red-100 px-2 py-1
                                 text-[8px] font-bold text-red-700">
                NOT MET
            </span>

        </div>


        <div class="grid grid-cols-2 gap-2 p-2.5">

            ${snapKPI(
                "Coverage",
                "62%",
                "Required: 90%"
            )}

            ${snapKPI(
                "Pass Rate",
                "75%",
                "Required: 85%"
            )}

            ${snapKPI(
                "Critical Bugs",
                "3",
                "Required: 0"
            )}

            ${snapKPI(
                "Completion",
                "64%",
                "Required: 100%"
            )}

        </div>


        <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-red-200
                            bg-red-50 p-2.5">

            <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-red-600">
                !
            </div>

            <div>

                <div class="text-[9.5px] font-bold
                                    text-red-800">
                    4 of 4 conditions unmet
                </div>

                <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-red-700/80">

                    Release is not recommended until
                    the quality gate conditions are met.

                </div>

            </div>

        </div>

        `;

                }


        /* =====================================================
           DELIVERY - Q4
           ===================================================== */

        if (role === "delivery" && q === "q4") {

                    return `

        <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

            <span class="text-[11px] font-bold text-slate-700">
                Descope Recommendations
            </span>

            <span class="rounded-md bg-amber-100 px-2 py-1
                                 text-[8px] font-bold text-amber-700">
                RISK REDUCTION
            </span>

        </div>


        <div class="px-2.5">

            ${snapRiskRow(
                "01",
                "Advanced Report Export",
                "Coverage 31% · 6 bugs · LOW",
                "DESCOPE",
                "red"
            )}

            ${snapRiskRow(
                "02",
                "Bulk Notification Sender",
                "Coverage 28% · 4 bugs · LOW",
                "DESCOPE",
                "red"
            )}

            ${snapRiskRow(
                "✓",
                "User Login & Auth",
                "Coverage 94% · 1 bug · HIGH",
                "KEEP",
                "green"
            )}

            ${snapRiskRow(
                "✓",
                "Test Case Assignment",
                "Coverage 88% · 2 bugs · HIGH",
                "KEEP",
                "green"
            )}

        </div>


        ${snapRecommendation(
            "Estimated Impact",
            "Descoping these 2 features could reduce open risk by approximately 40%."
        )}

        `;

                }


        /* =====================================================
           DELIVERY - Q5
           ===================================================== */

        if (role === "delivery" && q === "q5") {

                    return `

        <div class="flex items-center justify-between
                            border-b border-slate-100 px-3 py-3">

            <span class="text-[11px] font-bold text-slate-700">
                Detection Effectiveness
            </span>

            <span class="rounded-md bg-amber-100 px-2 py-1
                                 text-[8px] font-bold text-amber-700">
                78%
            </span>

        </div>


        <div class="grid grid-cols-2 gap-2 p-2.5">

            ${snapKPI(
                "Caught Before Release",
                "39",
                "QA detected"
            )}

            ${snapKPI(
                "Client Reported",
                "11",
                "Post-release"
            )}

            ${snapKPI(
                "Total Bugs",
                "50",
                ""
            )}

            ${snapKPI(
                "Benchmark",
                "85%+",
                "Strong"
            )}

        </div>


        <div class="mx-2.5 mb-2.5 rounded-lg
                            border border-slate-100 p-2.5">

            <div class="mb-1.5 flex items-center
                                justify-between">

                <span class="text-[9px] text-slate-500">
                    Detection effectiveness
                </span>

                <span class="text-[9px] font-bold text-slate-700">
                    78%
                </span>

            </div>

            <div class="h-1.5 overflow-hidden
                                rounded-full bg-slate-200">

                <div
                    class="h-full rounded-full
                                   bg-gradient-to-r
                                   from-blue-600 to-indigo-600"
                    style="width:78%">
                </div>

            </div>

        </div>


        <div class="mx-2.5 mb-2.5 flex gap-2
                            rounded-lg border border-amber-200
                            bg-amber-50 p-2.5">

            <div class="flex h-6 w-6 shrink-0
                                items-center justify-center
                                rounded-md bg-white/70
                                text-xs text-amber-600">
                ⚠
            </div>

            <div>

                <div class="text-[9.5px] font-bold
                                    text-amber-800">
                    7 points below benchmark
                </div>

                <div class="mt-0.5 text-[8.5px]
                                    leading-4 text-amber-700/80">

                    11 bugs reached the client, indicating
                    possible test coverage or edge-case gaps.

                </div>

            </div>

        </div>


        ${snapRecommendation(
            "Recommendation",
            "Review the 11 post-release bugs and add test cases for those scenarios in the next sprint."
        )}

        `;

                }


        return `

        <div class="p-4 text-[10px] text-slate-500">
            No dummy data configured.
        </div>

        `;

            }


        /* =========================================================
           HELPER - KPI
           ========================================================= */

        function snapKPI(label, value, sub) {

                return `

        <div class="rounded-lg border border-slate-100
                        bg-slate-50/70 p-2.5">

            <div class="text-[8.5px] text-slate-400">
                ${label}
            </div>

            <div class="mt-1 text-[16px]
                            font-bold tracking-tight
                            text-slate-800">

                ${value}

            </div>

            ${sub
                ?
                `<div class="mt-0.5 text-[8.5px] text-slate-400">
                        ${sub}
                    </div>`
                :
                ""
            }

        </div>

        `;

            }


        /* =========================================================
           HELPER - RISK ROW
           ========================================================= */

        function snapRiskRow(
        rank,
        name,
        detail,
        badge,
        type
        ) {

            let badgeClass = "bg-slate-100 text-slate-600";

        if (type === "red") {
            badgeClass = "bg-red-100 text-red-700";
                }

        if (type === "amber") {
            badgeClass = "bg-amber-100 text-amber-700";
                }

        if (type === "green") {
            badgeClass = "bg-green-100 text-green-700";
                }

        return `

        <div class="flex items-center gap-2
                        border-b border-slate-100 py-2.5
                        last:border-b-0">

            <div class="flex h-[22px] w-[22px] shrink-0
                            items-center justify-center
                            rounded-md bg-slate-50
                            text-[8px] font-bold
                            text-slate-500">

                ${rank}

            </div>


            <div class="min-w-0 flex-1">

                <div class="truncate text-[9.5px]
                                font-semibold text-slate-700">

                    ${name}

                </div>

                <div class="mt-0.5 text-[8px]
                                text-slate-400">

                    ${detail}

                </div>

            </div>


            <span
                class="shrink-0 rounded-md px-1.5 py-1
                           text-[7.5px] font-bold ${badgeClass}">

                ${badge}

            </span>

        </div>

        `;

            }


        /* =========================================================
           HELPER - RECOMMENDATION
           ========================================================= */

        function snapRecommendation(
        title,
        text
        ) {

                return `

        <div class="mx-2.5 mb-2.5 rounded-lg
                        border border-blue-100
                        bg-blue-50/70 p-2.5">

            <div class="mb-1 text-[8.5px]
                            font-bold uppercase
                            tracking-wider text-blue-600">

                ✦ ${title}

            </div>

            <div class="text-[9px]
                            leading-4 text-blue-900/75">

                ${text}

            </div>

        </div>

        `;

            }


        /* =========================================================
           HELPER - TREND ROW
           ========================================================= */

        function snapTrendRow(
        sprint,
        velocity,
        passRate,
        bugs
        ) {

                return `

        <div class="flex items-center gap-3
                        rounded-lg border border-slate-100
                        bg-slate-50/70 p-2.5">

            <div class="flex h-8 w-8 shrink-0
                            items-center justify-center
                            rounded-lg bg-violet-50
                            text-[8px] font-bold
                            text-violet-600">

                ${sprint.replace("Sprint ", "S")}

            </div>


            <div class="flex-1">

                <div class="text-[9.5px]
                                font-semibold text-slate-700">

                    ${sprint}

                </div>

                <div class="mt-0.5 text-[8px]
                                text-slate-400">

                    Velocity ${velocity}
                    · Pass ${passRate}
                    · Bugs ${bugs}

                </div>

            </div>


            <div class="text-right">

                <div class="text-[12px]
                                font-bold text-slate-800">

                    ${velocity}

                </div>

                <div class="text-[8px] text-slate-400">
                    cases
                </div>

            </div>

        </div>

        `;

            }


    /* =========================================================
       SNAP AI CHATBOT - INIT
       Called from FRONTEND.js's DOMContentLoaded handler,
       only when the Dashboard view's chatbot markup is
       actually present in the page.
       ========================================================= */

    function initSnapAIChatbot() {

        document.addEventListener(
        "keydown",
        function (event) {

                    if (event.key === "Escape") {
            closeSnapAI();
                    }

                }
        );

    }

/* ============================================================
   SNAP LIVE API INTEGRATION
   Backend: http://localhost:5154/api/dashboard
   This section intentionally replaces dashboard demo chart data.
   ============================================================ */
(function () {
    'use strict';

    const SNAP_API_URL = 'http://localhost:5154/api/dashboard';
    const SNAP_TEAM_TARGET = 60;   // same target the page shows in the "Target: 60%" badge
    let snapLiveData = null;
    let snapLiveError = null;

    function snapSetStatus(message, ok) {
        let status = document.getElementById('snapApiStatus');
        if (!status) {
            status = document.createElement('div');
            status.id = 'snapApiStatus';
            status.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;padding:9px 13px;border-radius:9px;font:12px/1.4 Arial,sans-serif;box-shadow:0 3px 14px #0002;max-width:360px';
            document.body.appendChild(status);
        }
        status.textContent = message;
        status.style.background = ok ? '#dcfce7' : '#fee2e2';
        status.style.color = ok ? '#166534' : '#991b1b';
    }

    function snapChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        return canvas && window.Chart ? Chart.getChart(canvas) : null;
    }

    // Safe wrappers: one failing chart must not stop the others, and the log names the culprit.
    function snapSafeUpdate(chart, canvasId) {
        try { chart.update(); }
        catch (err) { console.error('SNAP chart update failed for #' + canvasId + ':', err); }
    }

    function snapUpdateChart(canvasId, labels, datasets) {
        const chart = snapChart(canvasId);
        if (!chart) { console.warn('SNAP: chart not found: #' + canvasId); return; }
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        snapSafeUpdate(chart, canvasId);
    }

    function snapEscape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function snapSetCardValue(labelText, value) {
        const labels = Array.from(document.querySelectorAll('span'));
        const label = labels.find(el => el.textContent.trim().replace(/\s+/g, ' ') === labelText);
        if (!label) return;
        let card = label;
        while (card && card !== document.body && !(card.classList && card.classList.contains('bg-white') && card.classList.contains('border'))) card = card.parentElement;
        if (!card || card === document.body) return;
        const valueNode = Array.from(card.children).find(child => child.classList && child.classList.contains('mt-[15px]'));
        if (valueNode) valueNode.textContent = value;
    }

    // ---- Keep on-screen text consistent with the live numbers (only values the API supports) ----
    function snapCardByLabel(labelText) {
        const label = Array.from(document.querySelectorAll('span')).find(el => el.textContent.trim().replace(/\s+/g, ' ') === labelText);
        let card = label;
        while (card && card !== document.body && !(card.classList && card.classList.contains('bg-white') && card.classList.contains('border'))) card = card.parentElement;
        return card && card !== document.body ? card : null;
    }

    // Updates the small line under a KPI value, e.g. "53%  completed". restText = null keeps the grey text.
    function snapSetCardNote(labelText, strongText, restText, good) {
        const card = snapCardByLabel(labelText);
        const note = card && card.children[2];
        if (!note || note.children.length < 2) return;
        note.children[0].textContent = strongText;
        if (restText != null) note.children[1].textContent = restText;
        if (typeof good === 'boolean') note.children[0].className = (good ? 'text-[#15803d]' : 'text-[#dc2626]') + ' font-[700]';
    }

    function snapLeafMatch(tag, regex) {
        return Array.from(document.querySelectorAll(tag)).find(el => el.children.length === 0 && regex.test(el.textContent.trim().replace(/\s+/g, ' ')));
    }

    function snapSetBoxValue(labelText, value) {
        const label = snapLeafMatch('div', new RegExp('^' + labelText + '$'));
        if (label && label.nextElementSibling) label.nextElementSibling.textContent = value;
    }

    function snapSyncStaticText(data) {
        const passFail = (data.tester && data.tester.passFail) || {};
        const passed = Number(passFail.passed) || 0;
        const failed = Number(passFail.failed) || 0;
        const total = Number(data.meta && data.meta.totalIssues) || 0;

        // Tester KPI notes: completed % of all issues, failure rate among categorised issues
        snapSetCardNote('Completed', (total ? Math.round(passed / total * 100) : 0) + '%');
        snapSetCardNote('Failed', ((passed + failed) ? Math.round(failed / (passed + failed) * 100) : 0) + '%');

        // Tester sprint progress: expected pace = 60% of all issues (matches "Day 6 of 10" and the 60% target)
        const expected = Math.round(total * 0.6);
        const behind = Math.max(0, expected - passed);
        const prog = snapLeafMatch('div', /^\d+ of \d+ completed$/);
        if (prog) prog.textContent = passed + ' of ' + total + ' completed';
        const bar = document.querySelector('[class*="w-[53.33%]"]');
        if (bar) bar.style.width = (total ? passed / total * 100 : 0) + '%';
        const exp = snapLeafMatch('div', /^Expected by today: \d+ cases$/);
        if (exp) exp.textContent = 'Expected by today: ' + expected + ' cases';
        const beh = snapLeafMatch('span', /^\d+ Cases? Behind$/);
        if (beh) beh.textContent = behind + ' Cases Behind';
        snapSetBoxValue('Completed', passed);
        snapSetBoxValue('Remaining', Math.max(0, total - passed));
        snapSetBoxValue('Expected', expected);

        // Delivery KPI: defect detection % = caught / (caught + client reported), benchmark 85%
        const eff = data.delivery && data.delivery.defectDetectionEffectiveness;
        if (eff) {
            const c = Number(eff.caughtBeforeRelease) || 0;
            const r = Number(eff.reportedByClient) || 0;
            if (c + r > 0) {
                const pct = Math.round(c / (c + r) * 100);
                const diff = pct - 85;
                snapSetCardValue('Defect Detection', pct + '%');
                snapSetCardNote('Defect Detection', (diff >= 0 ? '+' : '\u2212') + Math.abs(diff) + ' pts', null, diff >= 0);
            }
        }
    }

    function snapRenderTeamTable(rows) {
        const canvas = document.getElementById('managerTeamChart');
        if (!canvas) return;
        const table = canvas.closest('section, div') && canvas.closest('section, div').parentElement;
        // Locate the existing table by its header text, rather than relying on layout-specific IDs.
        const allTables = Array.from(document.querySelectorAll('table'));
        const teamTable = allTables.find(t => /Tester/i.test(t.querySelector('thead')?.innerText || '') && /Assigned/i.test(t.querySelector('thead')?.innerText || '') && /Completed/i.test(t.querySelector('thead')?.innerText || ''));
        if (!teamTable) return;
        const tbody = teamTable.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = rows.map(r => {
            const pct = Number(r.completedPercentage) || 0;
            const status = pct >= SNAP_TEAM_TARGET ? 'ON TRACK' : 'BEHIND';
            const badge = pct >= SNAP_TEAM_TARGET ? 'bg-[#ecfdf3] text-[#15803d]' : 'bg-[#fef2f2] text-[#dc2626]';
            return `<tr>
              <td class="px-[11px] py-[11px] border-b border-[#f1f3f6] text-[#374151] text-xs"><span class="font-[700] text-[#111827]">${snapEscape(r.tester)}</span></td>
              <td class="px-[11px] py-[11px] border-b border-[#f1f3f6] text-[#374151] text-xs">—</td>
              <td class="px-[11px] py-[11px] border-b border-[#f1f3f6] text-[#374151] text-xs">—</td>
              <td class="px-[11px] py-[11px] border-b border-[#f1f3f6] text-[#374151] text-xs">${pct.toFixed(0)}%</td>
              <td class="px-[11px] py-[11px] border-b border-[#f1f3f6] text-[#374151] text-xs"><span class="inline-flex items-center px-[9px] py-[5px] rounded-[20px] text-[10px] font-[750] ${badge}">${status}</span></td>
            </tr>`;
        }).join('');
        // API currently returns percentages only; make it explicit that issue counts are not supplied.
    }

    function snapApplyData(data) {
        snapLiveData = data;
        const tester = data.tester || {};
        const passFail = tester.passFail || {};
        snapUpdateChart('testerPassFailChart', ['Passed', 'Failed'], [{
            label: 'Issues', data: [Number(passFail.passed) || 0, Number(passFail.failed) || 0],
            backgroundColor: ['#42AD3E', '#F73B3B'], borderWidth: 0, hoverOffset: 5
        }]);

        const burndown = data.manager && data.manager.burndown;
        if (burndown) {
            snapUpdateChart('managerBurndownChart', burndown.labels || [], [
                { label: 'Ideal remaining', data: burndown.ideal || [], borderColor: '#aeb5c0', borderDash: [7,5], borderWidth: 2, pointRadius: 2, tension: 0 },
                { label: 'Actual remaining', data: burndown.actual || [], borderColor: '#233b68', backgroundColor: 'rgba(35,59,104,.05)', borderWidth: 3, pointRadius: 3, tension: .25, fill: false }
            ]);
        }

        const defects = data.manager && data.manager.defectDensity || [];
        snapUpdateChart('managerDefectChart', defects.map(x => x.module), [{
            label: 'Bug count', data: defects.map(x => Number(x.value) || 0), backgroundColor: '#233b68', borderRadius: 5
        }]);
        const defectChart = snapChart('managerDefectChart');
        if (defectChart) {
            if (defectChart.options.scales && defectChart.options.scales.y) {
                defectChart.options.scales.y.max = undefined;
                defectChart.options.scales.y.ticks = Object.assign({}, defectChart.options.scales.y.ticks, { callback: value => value });
            }
            snapSafeUpdate(defectChart, 'managerDefectChart');
        }

        const team = data.manager && data.manager.teamPerformance || [];
        snapUpdateChart('managerTeamChart', team.map(x => x.tester), [{
            label: 'Completed issues (%)', data: team.map(x => Number(x.completedPercentage) || 0),
            backgroundColor: ['#233b68', '#31558b', '#6685b4', '#8fa7ca', '#a8b9d4', '#c3cfe0'], borderRadius: 5
        }]);
        snapRenderTeamTable(team);

        const trend = data.manager && data.manager.sprintTrend || [];
        snapUpdateChart('managerTrendChart', trend.map(x => x.sprint), [
            { label: 'Completed issues (velocity)', data: trend.map(x => Number(x.velocity) || 0), borderColor: '#233b68', backgroundColor: 'rgba(35,59,104,.08)', borderWidth: 3, tension: .25, yAxisID: 'y' },
            { label: 'Bugs', data: trend.map(x => Number(x.bugCount) || 0), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.08)', borderWidth: 2, tension: .25, yAxisID: 'y' },
            { label: 'Pass rate (%)', data: trend.map(x => Number(x.passRate) || 0), borderColor: '#16a34a', borderWidth: 2, tension: .25, yAxisID: 'y1' }
        ]);
        const trendChart = snapChart('managerTrendChart');
        if (trendChart) snapSafeUpdate(trendChart, 'managerTrendChart');

        const effectiveness = data.delivery && data.delivery.defectDetectionEffectiveness;
        if (effectiveness) {
            snapUpdateChart('deliveryDefectEffectivenessChart', ['Caught before release', 'Reported by client'], [{
                label: 'Bugs', data: [Number(effectiveness.caughtBeforeRelease) || 0, Number(effectiveness.reportedByClient) || 0],
                backgroundColor: ['#42AD3E', '#F73B3B'], borderWidth: 0, hoverOffset: 5
            }]);
        }

        // Update only values the API actually supplies. Do not fabricate unsupported KPI values.
        snapSetCardValue('Completed', String(Number(passFail.passed) || 0));
        snapSetCardValue('Failed', String(Number(passFail.failed) || 0));
        if (data.meta && Number.isFinite(Number(data.meta.totalIssues))) {
            snapSetCardValue('Assigned Cases', String(data.meta.totalIssues));
        }
        snapSyncStaticText(data);
        // Clearly mark dashboard metrics which this API does not return.
        ['Sprint Completion', 'Team Velocity', 'Defect Density', 'Pass Rate', 'Efficiency', 'Delivery Probability', 'Release Risk', 'Quality Gates'].forEach(label => {
            const spans = Array.from(document.querySelectorAll('span'));
            const node = spans.find(el => el.textContent.trim().replace(/\s+/g, ' ') === label);
            if (!node) return;
            let card = node;
            while (card && card !== document.body && !(card.classList && card.classList.contains('bg-white') && card.classList.contains('border'))) card = card.parentElement;
            if (!card || card === document.body) return;
            const valueNode = Array.from(card.children).find(child => child.classList && child.classList.contains('mt-[15px]'));
            if (valueNode) valueNode.textContent = '—';
        });

        const warningText = (data.meta && data.meta.warnings || []).join(' ');
        snapSetStatus('Live Jira data connected' + (data.meta && data.meta.totalIssues != null ? ' · ' + data.meta.totalIssues + ' issues' : '') + (warningText ? ' · API warning present' : ''), true);
        if (warningText) console.warn('SNAP API warning:', warningText);
        if (data.meta && data.meta.generatedAt) console.info('SNAP data generated at:', data.meta.generatedAt);
        document.dispatchEvent(new CustomEvent('snapDashboardDataLoaded', { detail: data }));
    }

    function snapLiveChatAnswer(role, question) {
        if (!snapLiveData) return '<p>Live Jira data is not available yet. Check that the API is running at <code>' + SNAP_API_URL + '</code>.</p>';
        const d = snapLiveData;
        const esc = snapEscape;
        if (role === 'tester' && question === 'q4') {
            const p = Number(d.tester?.passFail?.passed) || 0;
            const f = Number(d.tester?.passFail?.failed) || 0;
            const total = p + f;
            return `<p><strong>API-backed issue status:</strong> ${p} passed/completed and ${f} failed/not completed, out of ${total} categorized issues.</p><p>Note: the backend currently maps issue statuses into these buckets; these are not necessarily formal test-case execution results.</p>`;
        }
        if (role === 'manager' && question === 'q2') {
            const rows = d.manager?.defectDensity || [];
            if (!rows.length) return '<p>The API returned no module defect data.</p>';
            const top = [...rows].sort((a,b) => (Number(b.value)||0) - (Number(a.value)||0))[0];
            return `<p><strong>Highest bug count by module:</strong> ${esc(top.module)} with ${Number(top.value)||0} bugs.</p><p>This API returns bug counts by module, not normalized defect density.</p>`;
        }
        if (role === 'manager' && question === 'q3') {
            const rows = d.manager?.teamPerformance || [];
            if (!rows.length) return '<p>The API returned no team performance data.</p>';
            return '<p>Team completion percentages from Jira:</p><ul>' + rows.map(x => `<li><strong>${esc(x.tester)}:</strong> ${Number(x.completedPercentage)||0}%</li>`).join('') + '</ul><p>Assigned and completed issue counts are not included in the current API response.</p>';
        }
        if (role === 'manager' && question === 'q4') {
            const rows = d.manager?.sprintTrend || [];
            if (!rows.length) return '<p>The API returned no sprint trend data.</p>';
            return '<ul>' + rows.map(x => `<li><strong>${esc(x.sprint)}:</strong> ${Number(x.velocity)||0} completed issues, ${Number(x.bugCount)||0} bugs, ${Number(x.passRate)||0}% pass rate</li>`).join('') + '</ul><p>Velocity here is completed issue count, not story points.</p>';
        }
        if (role === 'delivery' && question === 'q5') {
            const x = d.delivery?.defectDetectionEffectiveness;
            if (!x) return '<p>The API did not return defect detection effectiveness.</p>';
            return `<p><strong>${Number(x.caughtBeforeRelease)||0}</strong> bugs counted as caught before release and <strong>${Number(x.reportedByClient)||0}</strong> reported by clients.</p><p>See API metadata warnings for the counting rule and label limitations.</p>`;
        }
        return '<p>This question asks for a metric the current API does not provide. The dashboard will not invent a value. Available live data includes pass/fail issue counts, burndown arrays, bugs by module, team completion percentages, sprint trends, defect effectiveness, and API metadata.</p>';
    }

    // Existing chatbot UI remains intact; answers now use live values when supported.
    if (typeof window.getSnapDummyAnswer === 'function') {
        window.getSnapDummyAnswer = function (role, question) {
            return snapLiveChatAnswer(role, question);
        };
    }

    function snapSetCriticalGate(data) {
        const n = data.delivery && data.delivery.criticalBugsOpen;
        if (n == null) return;
        const label = Array.from(document.querySelectorAll('div')).find(el => el.children.length === 0 && el.textContent.trim() === 'Critical Bugs');
        const row = label && label.parentElement;
        if (!row || row.children.length < 4) return;
        row.children[2].children[1].textContent = n;
        const pass = n <= 0;
        const badge = row.children[3];
        badge.textContent = pass ? 'PASS' : 'FAIL';
        badge.className = 'px-2 py-[5px] rounded-[15px] text-[10px] font-[800] text-center ' + (pass ? 'bg-[#f0fdf4] text-[#15803d]' : 'bg-[#fef2f2] text-[#dc2626]');
    }

    async function snapLoadApi() {
        try {
            snapSetStatus('Connecting to Jira API…', true);
            const response = await fetch(SNAP_API_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
            const data = await response.json();
            if (!data || typeof data !== 'object') throw new Error('API response was not a JSON object.');
            snapApplyData(data);
            snapSetCriticalGate(data);
        } catch (error) {
            snapLiveError = error;
            console.error('SNAP API connection failed:', error);
            snapSetStatus('API connection failed · ' + error.message, false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', snapLoadApi);
    else snapLoadApi();
})();
