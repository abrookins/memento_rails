class GeographicEventsController < ApplicationController
  respond_to :json
  before_filter :authenticate_user!

  def index
    @geographic_events = current_user.geographic_events.all
    ActiveRecord::Base.include_root_in_json = false
    respond_with @geographic_events
  end

  def show
    @geographic_event = GeographicEvent.find(params[:id])
    ActiveRecord::Base.include_root_in_json = false
    respond_with @geographic_event
  end

  def create
    @geographic_event = GeographicEvent.new(params[:geographic_event])
    @geographic_event.user = current_user
    @geographic_event.save

    respond_with(@geographic_event) do |format|
      format.json do |format|
        if @geographic_event.valid? 
          render :json => @geographic_event.to_json
        else
          render :json => @geographic_event.to_json, :status => :unprocessable_entity
        end
      end
    end
  end

  def update
    @geographic_event = GeographicEvent.find(params[:id])
    # TODO: Need an edit view for this to work correctly with validation errors?
    @geographic_event.update_attributes(params[:geographic_event])

    respond_with(@map) do |format|
      format.json do |format|
        if @geographic_event.valid? 
          render :json => @geographic_event.to_json
        else
          render :json => @geographic_event.to_json, :status => :unprocessable_entity
        end
      end
    end
  end  

  def destroy
  end
end
